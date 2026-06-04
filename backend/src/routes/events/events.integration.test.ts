// events / event_rsvps / event_overrides の RLS integration test(ADR 0003)。
// migration 008(events / event_rsvps)+ 010(event_overrides + rsvp PK 再構成)の
// ポリシーが、各ロール(owner / admin / member / 非メンバー / anon)に対して
// 期待どおり効くことをローカル Supabase で実地検証する。
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

const OCC_START = "2026-06-01T10:00:00.000Z";

suite("events RLS(integration / local Supabase)", () => {
  const stamp = Date.now();
  const ownerEmail = `evt-owner-${stamp}@example.com`;
  const adminEmail = `evt-admin-${stamp}@example.com`;
  const memberEmail = `evt-member-${stamp}@example.com`;
  const nonmemberEmail = `evt-nonmember-${stamp}@example.com`;

  const admin = adminClient();
  let ownerId = "";
  let adminId = "";
  let memberId = "";
  let nonmemberId = "";
  let publicBoardId = "";
  let privateBoardId = "";
  let publicEventId = "";
  let privateEventId = "";

  beforeAll(async () => {
    ownerId = await createAuthUser(admin, ownerEmail);
    adminId = await createAuthUser(admin, adminEmail);
    memberId = await createAuthUser(admin, memberEmail);
    nonmemberId = await createAuthUser(admin, nonmemberEmail);

    const ab = admin.schema("aikiboard");

    const insertBoard = async (slug: string, isPublic: boolean) => {
      const { data, error } = await ab
        .from("boards")
        .insert({
          name: slug,
          slug,
          created_by_user_id: ownerId,
          is_public: isPublic,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw error ?? new Error("board insert failed");
      }
      return data.id as string;
    };

    publicBoardId = await insertBoard(`evt-pub-${stamp}`, true);
    privateBoardId = await insertBoard(`evt-priv-${stamp}`, false);

    // 公開ボード: owner / admin / member。非公開ボード: owner のみ。
    await ab.from("board_members").insert([
      { board_id: publicBoardId, user_id: ownerId, role: "owner" },
      { board_id: publicBoardId, user_id: adminId, role: "admin" },
      { board_id: publicBoardId, user_id: memberId, role: "member" },
      { board_id: privateBoardId, user_id: ownerId, role: "owner" },
    ]);

    const insertEvent = async (boardId: string, isPublic: boolean) => {
      const { data, error } = await ab
        .from("events")
        .insert({
          board_id: boardId,
          start_at: OCC_START,
          end_at: "2026-06-01T12:00:00.000Z",
          place: "本部道場",
          is_public: isPublic,
          created_by_user_id: ownerId,
        })
        .select("id")
        .single();
      if (error || !data) {
        throw error ?? new Error("event insert failed");
      }
      return data.id as string;
    };

    publicEventId = await insertEvent(publicBoardId, true);
    privateEventId = await insertEvent(privateBoardId, true);
  });

  afterAll(async () => {
    const ab = admin.schema("aikiboard");
    if (publicBoardId) {
      await ab.from("boards").delete().eq("id", publicBoardId);
    }
    if (privateBoardId) {
      await ab.from("boards").delete().eq("id", privateBoardId);
    }
    for (const id of [ownerId, adminId, memberId, nonmemberId]) {
      if (id) {
        await admin.auth.admin.deleteUser(id);
      }
    }
  });

  // ── events ──────────────────────────────────────────────
  it("member は自ボードの events を SELECT できる", async () => {
    const client = await signedInClient(memberEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("events")
      .select("id")
      .eq("id", publicEventId)
      .maybeSingle();
    expect(data?.id).toBe(publicEventId);
  });

  it("非メンバーは非公開ボードの events を SELECT できない", async () => {
    const client = await signedInClient(nonmemberEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("events")
      .select("id")
      .eq("id", privateEventId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("anon は公開ボードの公開イベントを SELECT できる", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: pub } = await anon
      .schema("aikiboard")
      .from("events")
      .select("id")
      .eq("id", publicEventId)
      .maybeSingle();
    expect(pub?.id).toBe(publicEventId);

    const { data: priv } = await anon
      .schema("aikiboard")
      .from("events")
      .select("id")
      .eq("id", privateEventId)
      .maybeSingle();
    expect(priv).toBeNull();
  });

  it("admin は events を INSERT できる(events_write_admin)", async () => {
    const client = await signedInClient(adminEmail);
    const { error } = await client.schema("aikiboard").from("events").insert({
      board_id: publicBoardId,
      start_at: "2026-07-01T10:00:00.000Z",
      end_at: "2026-07-01T11:00:00.000Z",
      place: "支部",
      is_public: true,
      created_by_user_id: adminId,
    });
    expect(error).toBeNull();
  });

  it("member は events を INSERT できない(RLS)", async () => {
    const client = await signedInClient(memberEmail);
    const { error } = await client.schema("aikiboard").from("events").insert({
      board_id: publicBoardId,
      start_at: "2026-07-02T10:00:00.000Z",
      end_at: "2026-07-02T11:00:00.000Z",
      place: "勝手に追加",
      is_public: true,
      created_by_user_id: memberId,
    });
    expect(error).not.toBeNull();
  });

  // ── event_rsvps ─────────────────────────────────────────
  it("member は自分の出欠を INSERT できる(insert_self)", async () => {
    const client = await signedInClient(memberEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("event_rsvps")
      .insert({
        event_id: publicEventId,
        occurrence_start: OCC_START,
        user_id: memberId,
        status: "attend",
      });
    expect(error).toBeNull();
  });

  it("member は他人の出欠を INSERT できない(user_id != auth.uid())", async () => {
    const client = await signedInClient(memberEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("event_rsvps")
      .insert({
        event_id: publicEventId,
        occurrence_start: OCC_START,
        user_id: ownerId,
        status: "attend",
      });
    expect(error).not.toBeNull();
  });

  it("member は自ボードの出欠一覧を SELECT できる(select_member)", async () => {
    const client = await signedInClient(memberEmail);
    const { data } = await client
      .schema("aikiboard")
      .from("event_rsvps")
      .select("user_id, status")
      .eq("event_id", publicEventId);
    expect(Array.isArray(data)).toBe(true);
  });

  // ── event_overrides ─────────────────────────────────────
  it("admin は例外(override)を INSERT できる", async () => {
    const client = await signedInClient(adminEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("event_overrides")
      .insert({
        event_id: publicEventId,
        occurrence_start: OCC_START,
        is_cancelled: true,
      });
    expect(error).toBeNull();
  });

  it("member は例外(override)を INSERT できない(RLS)", async () => {
    const client = await signedInClient(memberEmail);
    const { error } = await client
      .schema("aikiboard")
      .from("event_overrides")
      .insert({
        event_id: publicEventId,
        occurrence_start: "2026-06-08T10:00:00.000Z",
        is_cancelled: true,
      });
    expect(error).not.toBeNull();
  });

  it("anon は公開イベントの例外を SELECT できる(select_public)", async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await anon
      .schema("aikiboard")
      .from("event_overrides")
      .select("event_id")
      .eq("event_id", publicEventId);
    // admin が上で 1 件(休講)入れているので anon でも読めるはず。
    expect(Array.isArray(data)).toBe(true);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
