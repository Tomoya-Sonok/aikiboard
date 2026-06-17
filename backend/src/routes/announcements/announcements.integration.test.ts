// announcements / announcement_reads の RLS integration test(ADR 0003)。
// migration 008(基本ポリシー)+ 011(下書きの可視性を「管理者のみ」へ絞る防御)が、
// 各ロール(owner / admin / member / 非メンバー)に対して期待どおり効くことを
// ローカル Supabase で実地検証する。
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

suite("announcements RLS(integration / local Supabase)", () => {
  const stamp = Date.now();
  const ownerEmail = `ann-owner-${stamp}@example.com`;
  const adminEmail = `ann-admin-${stamp}@example.com`;
  const memberEmail = `ann-member-${stamp}@example.com`;
  const nonmemberEmail = `ann-nonmember-${stamp}@example.com`;

  const admin = adminClient();
  let ownerId = "";
  let adminId = "";
  let memberId = "";
  let nonmemberId = "";
  let boardId = "";
  let publishedId = "";
  let draftId = "";

  beforeAll(async () => {
    ownerId = await createAuthUser(admin, ownerEmail);
    adminId = await createAuthUser(admin, adminEmail);
    memberId = await createAuthUser(admin, memberEmail);
    nonmemberId = await createAuthUser(admin, nonmemberEmail);

    const ab = admin.schema("aikiboard");

    const { data: board, error: boardError } = await ab
      .from("boards")
      .insert({
        name: `ann-board-${stamp}`,
        slug: `ann-board-${stamp}`,
        created_by_user_id: ownerId,
        is_public: false,
      })
      .select("id")
      .single();
    if (boardError || !board) {
      throw boardError ?? new Error("board insert failed");
    }
    boardId = board.id;

    await ab.from("board_members").insert([
      { board_id: boardId, user_id: ownerId, role: "owner" },
      { board_id: boardId, user_id: adminId, role: "admin" },
      { board_id: boardId, user_id: memberId, role: "member" },
    ]);

    const insertAnnouncement = async (
      title: string,
      publishedAt: string | null,
    ) => {
      const { data, error } = await ab
        .from("announcements")
        .insert({
          board_id: boardId,
          title,
          body_rich: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: title }] },
            ],
          },
          created_by_user_id: ownerId,
          published_at: publishedAt,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw error ?? new Error("announcement insert failed");
      }
      return data.id as string;
    };

    publishedId = await insertAnnouncement(
      "公開済み",
      "2026-06-01T00:00:00.000Z",
    );
    draftId = await insertAnnouncement("下書き", null);
  });

  afterAll(async () => {
    const ab = admin.schema("aikiboard");
    if (boardId) {
      await ab.from("boards").delete().eq("id", boardId);
    }
    for (const id of [ownerId, adminId, memberId, nonmemberId]) {
      if (id) {
        await admin.auth.admin.deleteUser(id);
      }
    }
  });

  // ── announcements SELECT ─────────────────────────────────
  it("member は公開済みお知らせを SELECT できる", async () => {
    const client = await signedInClient(memberEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("announcements")
      .select("id")
      .eq("id", publishedId)
      .maybeSingle();
    expect(data?.id).toBe(publishedId);
  });

  it("member は下書きを SELECT できない(011 で防御)", async () => {
    const client = await signedInClient(memberEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("announcements")
      .select("id")
      .eq("id", draftId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("admin は下書きを SELECT できる", async () => {
    const client = await signedInClient(adminEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("announcements")
      .select("id")
      .eq("id", draftId)
      .maybeSingle();
    expect(data?.id).toBe(draftId);
  });

  it("非メンバーは公開済みお知らせも SELECT できない", async () => {
    const client = await signedInClient(nonmemberEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("announcements")
      .select("id")
      .eq("id", publishedId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("anon は(非公開ボードの)お知らせを SELECT できない", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await anon
      .schema("aikiboard")
      .from("announcements")
      .select("id")
      .eq("id", publishedId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  // ── announcements WRITE ──────────────────────────────────
  it("admin はお知らせを INSERT できる(write_admin)", async () => {
    const client = await signedInClient(adminEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("announcements")
      .insert({
        board_id: boardId,
        title: "幹部のお知らせ",
        body_rich: { type: "doc", content: [] },
        created_by_user_id: adminId,
      });
    expect(error).toBeNull();
  });

  it("member はお知らせを INSERT できない(RLS)", async () => {
    const client = await signedInClient(memberEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("announcements")
      .insert({
        board_id: boardId,
        title: "勝手に投稿",
        body_rich: { type: "doc", content: [] },
        created_by_user_id: memberId,
      });
    expect(error).not.toBeNull();
  });

  // ── announcement_reads ───────────────────────────────────
  it("member は公開済みお知らせを自分の既読として INSERT できる", async () => {
    const client = await signedInClient(memberEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("announcement_reads")
      .insert({ announcement_id: publishedId, user_id: memberId });
    expect(error).toBeNull();
  });

  it("member は下書きを既読にできない(011 の EXISTS 条件)", async () => {
    const client = await signedInClient(memberEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("announcement_reads")
      .insert({ announcement_id: draftId, user_id: memberId });
    expect(error).not.toBeNull();
  });

  it("member は他人の既読を INSERT できない(user_id != auth.uid())", async () => {
    const client = await signedInClient(memberEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("announcement_reads")
      .insert({ announcement_id: publishedId, user_id: ownerId });
    expect(error).not.toBeNull();
  });
});
