// ボード関連テーブルの RLS integration test(ADR 0003)。
// ローカル Supabase に対して、各ロール(owner / 非メンバー / anon)が
// RLS ポリシー(008)どおりにアクセス制御されることを実地検証する。
//
// 実行: `pnpm test:integration`(ルート .env.local の実値を dotenv で注入)。
// ローカル Supabase が起動していない / キー未設定なら describe.skip でスキップ。

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

suite("boards RLS(integration / local Supabase)", () => {
  const stamp = Date.now();
  const ownerEmail = `rls-owner-${stamp}@example.com`;
  const nonmemberEmail = `rls-nonmember-${stamp}@example.com`;

  const admin = adminClient();
  let ownerId = "";
  let nonmemberId = "";
  let publicBoardId = "";
  let privateBoardId = "";

  beforeAll(async () => {
    ownerId = await createAuthUser(admin, ownerEmail);
    nonmemberId = await createAuthUser(admin, nonmemberEmail);

    const ab = admin.schema("aikiboard");

    const { data: pub, error: pubErr } = await ab
      .from("boards")
      .insert({
        name: "公開ボード",
        slug: `rls-pub-${stamp}`,
        created_by_user_id: ownerId,
        is_public: true,
      })
      .select("id")
      .single();
    if (pubErr || !pub) {
      throw pubErr ?? new Error("public board insert failed");
    }
    publicBoardId = pub.id as string;
    await ab
      .from("board_members")
      .insert({ board_id: publicBoardId, user_id: ownerId, role: "owner" });

    const { data: priv, error: privErr } = await ab
      .from("boards")
      .insert({
        name: "非公開ボード",
        slug: `rls-priv-${stamp}`,
        created_by_user_id: ownerId,
        is_public: false,
      })
      .select("id")
      .single();
    if (privErr || !priv) {
      throw privErr ?? new Error("private board insert failed");
    }
    privateBoardId = priv.id as string;
    await ab
      .from("board_members")
      .insert({ board_id: privateBoardId, user_id: ownerId, role: "owner" });
  });

  afterAll(async () => {
    const ab = admin.schema("aikiboard");
    if (publicBoardId) {
      await ab.from("boards").delete().eq("id", publicBoardId);
    }
    if (privateBoardId) {
      await ab.from("boards").delete().eq("id", privateBoardId);
    }
    if (ownerId) {
      await admin.auth.admin.deleteUser(ownerId);
    }
    if (nonmemberId) {
      await admin.auth.admin.deleteUser(nonmemberId);
    }
  });

  it("owner は自分の非公開ボードを SELECT できる", async () => {
    const client = await signedInClient(ownerEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("boards")
      .select("id")
      .eq("id", privateBoardId)
      .maybeSingle();
    expect(data?.id).toBe(privateBoardId);
  });

  it("非メンバーは非公開ボードを SELECT できない", async () => {
    const client = await signedInClient(nonmemberEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("boards")
      .select("id")
      .eq("id", privateBoardId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("非メンバーでも公開ボードは SELECT できる", async () => {
    const client = await signedInClient(nonmemberEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("boards")
      .select("id")
      .eq("id", publicBoardId)
      .maybeSingle();
    expect(data?.id).toBe(publicBoardId);
  });

  it("anon は公開ボードのみ SELECT できる", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: pub } = await anon
      .schema("aikiboard")
      .from("boards")
      .select("id")
      .eq("id", publicBoardId)
      .maybeSingle();
    expect(pub?.id).toBe(publicBoardId);

    const { data: priv } = await anon
      .schema("aikiboard")
      .from("boards")
      .select("id")
      .eq("id", privateBoardId)
      .maybeSingle();
    expect(priv).toBeNull();
  });

  it("非メンバーは board_members に INSERT できない(RLS)", async () => {
    const client = await signedInClient(nonmemberEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("board_members")
      .insert({
        board_id: privateBoardId,
        user_id: nonmemberId,
        role: "member",
      });
    expect(error).not.toBeNull();
  });
});
