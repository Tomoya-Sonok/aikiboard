// feature_flag(プラン別機能制御、要件 6.5)。自前実装(外部サービス不使用)。
//
// ボードの契約(board_subscriptions)→ プラン(plans)→ プラン機能(plan_features)を辿り、
// 利用可能な feature code の集合を求める。アプリ側は hasFeature(boardId, 'archive') 等で判定。
//
// 契約が「有効」な状態(trialing/active/past_due の猶予)ならそのプランの機能、それ以外
// (canceled 等)や契約無しは Free プランの機能集合にフォールバックする。
// 決済(Stripe)未実装の現段階では、全ボードが Free のため有料機能はロックされる(正しい挙動)。

import type { SupabaseClient } from "@supabase/supabase-js";

// この状態なら契約プランの機能を有効とみなす(past_due は支払い猶予として許可)。
const ENTITLED_STATUSES = new Set(["trialing", "active", "past_due"]);

export const getEntitledFeatures = async (
  supabase: SupabaseClient,
  boardId: string,
): Promise<Set<string>> => {
  const aikiboard = supabase.schema("aikiboard");

  const { data: sub } = await aikiboard
    .from("board_subscriptions")
    .select("plan_id, status")
    .eq("board_id", boardId)
    .maybeSingle();

  let planId = (sub?.plan_id as string | undefined) ?? null;
  const entitled = sub != null && ENTITLED_STATUSES.has(sub.status as string);

  // 契約無し / 失効中は Free プランへフォールバック。
  if (!planId || !entitled) {
    const { data: free } = await aikiboard
      .from("plans")
      .select("id")
      .eq("code", "free")
      .maybeSingle();
    planId = (free?.id as string | undefined) ?? null;
  }
  if (!planId) {
    return new Set();
  }

  const { data: pf } = await aikiboard
    .from("plan_features")
    .select("feature_code")
    .eq("plan_id", planId);
  return new Set((pf ?? []).map((r) => r.feature_code as string));
};

export const hasFeature = async (
  supabase: SupabaseClient,
  boardId: string,
  featureCode: string,
): Promise<boolean> => {
  const features = await getEntitledFeatures(supabase, boardId);
  return features.has(featureCode);
};
