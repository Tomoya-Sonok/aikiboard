"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import authPage from "@/components/features/auth/authPage.module.css";
import { SignUpForm } from "@/components/features/auth/SignUpForm/SignUpForm";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "@/lib/i18n/routing";

type SignUpValues = { email: string; password: string; username: string };

export default function SignUpPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { signUp } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: SignUpValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await signUp(values);
      router.replace("/home");
    } catch (error) {
      // backend が返す具体的なメッセージ(重複 email / username 等)をそのまま表示
      setServerError(
        error instanceof Error ? error.message : t("signup.error.generic"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={authPage.page}>
      <SignUpForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        serverError={serverError}
      />
    </main>
  );
}
