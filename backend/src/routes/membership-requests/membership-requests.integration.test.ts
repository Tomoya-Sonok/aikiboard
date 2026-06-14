// membership_requests の RLS integration test(ADR 0003、migration 013)。
// 申請者は自分の申請を、管理者はボードの申請を閲覧でき、作成は本人、判定(UPDATE)は
// 管理者のみ、という防御層がローカル Supabase で効くことを検証する。
//
// 実行: `pnpm test:integration`。

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

suite("membership_requests RLS(integration / local Supabase)", () => {
  const stamp = Date.now();
  const ownerEmail = `req-owner-${stamp}@example.com`;
  const applicantEmail = `req-applicant-${stamp}@example.com`;
  const otherEmail = `req-other-${stamp}@example.com`;

  const admin = adminClient();
  let ownerId = "";
  let applicantId = "";
  let otherId = "";
  let boardId = "";
  let requestId = "";

  beforeAll(async () => {
    ownerId = await createAuthUser(admin, ownerEmail);
    applicantId = await createAuthUser(admin, applicantEmail);
    otherId = await createAuthUser(admin, otherEmail);

    const ab = admin.schema("aikiboard");
    const { data: board, error } = await ab
      .from("boards")
      .insert({
        name: `req-board-${stamp}`,
        slug: `req-board-${stamp}`,
        created_by_user_id: ownerId,
        is_public: true,
      })
      .select("id")
      .single();
    if (error || !board) {
      throw error ?? new Error("board insert failed");
    }
    boardId = board.id;
    await ab
      .from("board_members")
      .insert({ board_id: boardId, user_id: ownerId, role: "owner" });
  });

  afterAll(async () => {
    const ab = admin.schema("aikiboard");
    if (boardId) {
      await ab.from("boards").delete().eq("id", boardId);
    }
    for (const id of [ownerId, applicantId, otherId]) {
      if (id) {
        await admin.auth.admin.deleteUser(id);
      }
    }
  });

  it("申請者は自分の申請を INSERT できる", async () => {
    const client = await signedInClient(applicantEmail);
    const { data, error } = await client
      .schema("aikiboard")
      .from("membership_requests")
      .insert({
        board_id: boardId,
        user_id: applicantId,
        message: "お願いします",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    requestId = data?.id ?? "";
    expect(requestId).not.toBe("");
  });

  it("他人を装った申請は INSERT できない(user_id != auth.uid())", async () => {
    const client = await signedInClient(otherEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("membership_requests")
      .insert({ board_id: boardId, user_id: applicantId });
    expect(error).not.toBeNull();
  });

  it("同一ボードへの pending 重複は弾かれる(UNIQUE index)", async () => {
    const client = await signedInClient(applicantEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("membership_requests")
      .insert({ board_id: boardId, user_id: applicantId });
    expect(error).not.toBeNull();
  });

  it("申請者は自分の申請を SELECT できる", async () => {
    const client = await signedInClient(applicantEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("membership_requests")
      .select("id")
      .eq("id", requestId)
      .maybeSingle();
    expect(data?.id).toBe(requestId);
  });

  it("無関係なユーザーは申請を SELECT できない", async () => {
    const client = await signedInClient(otherEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("membership_requests")
      .select("id")
      .eq("id", requestId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("管理者はボードの申請を SELECT できる", async () => {
    const client = await signedInClient(ownerEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("membership_requests")
      .select("id")
      .eq("id", requestId)
      .maybeSingle();
    expect(data?.id).toBe(requestId);
  });

  it("申請者は自分の申請を承認(UPDATE)できない(管理者のみ)", async () => {
    const client = await signedInClient(applicantEmail);
    await client
      .schema("aikiboard")
      .from("membership_requests")
      .update({ status: "approved" })
      .eq("id", requestId);
    // RLS で UPDATE が無視され、status は pending のままであることを service_role で確認。
    const { data } = await admin
      .schema("aikiboard")
      .from("membership_requests")
      .select("status")
      .eq("id", requestId)
      .single();
    expect(data?.status).toBe("pending");
  });

  it("管理者は申請を承認(UPDATE)できる", async () => {
    const client = await signedInClient(ownerEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("membership_requests")
      .update({ status: "approved" })
      .eq("id", requestId);
    expect(error).toBeNull();
  });
});
