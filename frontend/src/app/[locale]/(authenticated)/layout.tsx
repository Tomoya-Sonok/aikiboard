// 認証必須ルートの Server Component guard(ADR 0002 B-5)。
// 未認証なら login へリダイレクト。フラッシュ無しで堅牢に弾く。

import { redirect } from "@/lib/i18n/routing";
import { getServerSupabase } from "@/lib/supabase/server";

type AuthenticatedLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AuthenticatedLayout({
  children,
  params,
}: AuthenticatedLayoutProps) {
  const { locale } = await params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: "/login", locale });
  }

  return <>{children}</>;
}
