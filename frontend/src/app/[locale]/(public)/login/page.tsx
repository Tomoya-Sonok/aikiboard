"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import authPage from "@/components/features/auth/authPage.module.css";
import { LoginForm } from "@/components/features/auth/LoginForm/LoginForm";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "@/lib/i18n/routing";
import type { LoginFormValues } from "@/lib/validation/auth";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { signInWithCredentials } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await signInWithCredentials(values);
      router.replace("/home");
    } catch {
      setServerError(t("login.error.invalidCredentials"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={authPage.page}>
      <LoginForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        serverError={serverError}
      />
    </main>
  );
}
