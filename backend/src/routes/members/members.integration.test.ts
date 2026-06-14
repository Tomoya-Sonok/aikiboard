// board_members / invitations の RLS integration test(ADR 0003)。
// migration 008(board_members / invitations のポリシー)+ 012(invitations マルチユース化)が
// 各ロールに対して期待どおり効くことをローカル Supabase で検証する。
//
// 実行: `pnpm test:integration`(ルート .env.local の実値を dotenv で注入)。

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PASSWORD = "Passw0rd!";

const ready = Boolean(ANON_KEY && SERVICE_KEY);
const suite = ready ? describe : describe.skip;

const adminClient = (): SupabaseClient =>
  createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function createAuthUser(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error("createUser failed");
  }
  return data.user.id;
}

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) {
    throw error;
  }
  return client;
}

suite("members / invitations RLS(integration / local Supabase)", () => {
  const stamp = Date.now();
  const ownerEmail = `mem-owner-${stamp}@example.com`;
  const adminEmail = `mem-admin-${stamp}@example.com`;
  const memberEmail = `mem-member-${stamp}@example.com`;
  const otherEmail = `mem-other-${stamp}@example.com`;

  const admin = adminClient();
  let ownerId = "";
  let adminId = "";
  let memberId = "";
  let otherId = "";
  let boardId = "";

  beforeAll(async () => {
    ownerId = await createAuthUser(admin, ownerEmail);
    adminId = await createAuthUser(admin, adminEmail);
    memberId = await createAuthUser(admin, memberEmail);
    otherId = await createAuthUser(admin, otherEmail);

    const ab = admin.schema("aikiboard");
    const { data: board, error } = await ab
      .from("boards")
      .insert({
        name: `mem-board-${stamp}`,
        slug: `mem-board-${stamp}`,
        created_by_user_id: ownerId,
        is_public: false,
      })
      .select("id")
      .single();
    if (error || !board) {
      throw error ?? new Error("board insert failed");
    }
    boardId = board.id;

    await ab.from("board_members").insert([
      { board_id: boardId, user_id: ownerId, role: "owner" },
      { board_id: boardId, user_id: adminId, role: "admin" },
      { board_id: boardId, user_id: memberId, role: "member" },
      { board_id: boardId, user_id: otherId, role: "member" },
    ]);
  });

  afterAll(async () => {
    const ab = admin.schema("aikiboard");
    if (boardId) {
      await ab.from("boards").delete().eq("id", boardId);
    }
    for (const id of [ownerId, adminId, memberId, otherId]) {
      if (id) {
        await admin.auth.admin.deleteUser(id);
      }
    }
  });

  // ── board_members SELECT ─────────────────────────────────
  it("member は自ボードのメンバー一覧を SELECT できる", async () => {
    const client = await signedInClient(memberEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("board_members")
      .select("user_id, role")
      .eq("board_id", boardId);
    expect((data ?? []).length).toBe(4);
  });

  // ── board_members INSERT(admin のみ)─────────────────────
  it("member は他人をメンバーに INSERT できない(RLS)", async () => {
    const client = await signedInClient(memberEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("board_members")
      .insert({ board_id: boardId, user_id: ownerId, role: "member" });
    expect(error).not.toBeNull();
  });

  // ── board_members DELETE(self or admin)──────────────────
  it("member は他人を削除できない(RLS)", async () => {
    const client = await signedInClient(memberEmail);
    await client
      .schema("aikiboard")
      .from("board_members")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", otherId);
    // RLS で対象行が見えず削除されない。other がまだ居ることを service_role で確認。
    const { data } = await admin
      .schema("aikiboard")
      .from("board_members")
      .select("user_id")
      .eq("board_id", boardId)
      .eq("user_id", otherId)
      .maybeSingle();
    expect(data?.user_id).toBe(otherId);
  });

  it("member は自分自身を削除できる(自主退会の RLS)", async () => {
    const client = await signedInClient(otherEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("board_members")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", otherId);
    expect(error).toBeNull();
    const { data } = await admin
      .schema("aikiboard")
      .from("board_members")
      .select("user_id")
      .eq("board_id", boardId)
      .eq("user_id", otherId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("admin はメンバーを削除できる", async () => {
    const client = await signedInClient(adminEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("board_members")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", memberId);
    expect(error).toBeNull();
  });

  // ── invitations(admin のみ・マルチユース化後の列)───────
  it("admin は招待を INSERT・SELECT できる", async () => {
    const client = await signedInClient(adminEmail);
    const { error: insertError } = await client
      .schema("aikiboard")
      .from("invitations")
      .insert({
        board_id: boardId,
        token: `tok-${stamp}`,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        label: "テスト",
        created_by_user_id: adminId,
      });
    expect(insertError).toBeNull();

    const { data } = await client
      .schema("aikiboard")
      .from("invitations")
      .select("id, token, revoked_at")
      .eq("board_id", boardId);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("member は招待を SELECT できない(RLS)", async () => {
    const client = await signedInClient(memberEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("invitations")
      .select("id")
      .eq("board_id", boardId);
    expect((data ?? []).length).toBe(0);
  });
});
