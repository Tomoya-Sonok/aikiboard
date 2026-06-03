"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/shared/Button/Button";
import { Link } from "@/lib/i18n/routing";
import {
  createEmailPasswordSchema,
  createUsernameSchema,
  type EmailPasswordValues,
  type UsernameValues,
} from "@/lib/validation/auth";
import styles from "../authForm.module.css";

type SignUpValues = { email: string; password: string; username: string };

type SignUpFormProps = {
  onSubmit: (values: SignUpValues) => void | Promise<void>;
  isSubmitting?: boolean;
  serverError?: string | null;
};

// 2 ステップ(email/password → username)のサインアップフォーム(presentational)。
export function SignUpForm({
  onSubmit,
  isSubmitting = false,
  serverError = null,
}: SignUpFormProps) {
  const t = useTranslations("auth");
  const [step, setStep] = useState<"credentials" | "username">("credentials");
  const [credentials, setCredentials] = useState<EmailPasswordValues | null>(
    null,
  );

  const credSchema = useMemo(() => createEmailPasswordSchema(t), [t]);
  const usernameSchema = useMemo(() => createUsernameSchema(t), [t]);

  const credForm = useForm<EmailPasswordValues>({
    resolver: zodResolver(credSchema),
    defaultValues: { email: "", password: "" },
  });
  const usernameForm = useForm<UsernameValues>({
    resolver: zodResolver(usernameSchema),
    defaultValues: { username: "" },
  });

  const handleCredentials = (values: EmailPasswordValues) => {
    setCredentials(values);
    setStep("username");
  };

  const handleUsername = async (values: UsernameValues) => {
    if (!credentials) {
      return;
    }
    await onSubmit({ ...credentials, username: values.username });
  };

  if (step === "credentials") {
    return (
      <form
        className={styles.form}
        onSubmit={credForm.handleSubmit(handleCredentials)}
        noValidate
      >
        <h1 className={styles.title}>{t("signup.title")}</h1>
        <p className={styles.subtitle}>{t("signup.step1Subtitle")}</p>

        {serverError ? (
          <p className={styles.serverError} role="alert">
            {serverError}
          </p>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="signup-email">
            {t("signup.email")}
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            className={styles.input}
            {...credForm.register("email")}
          />
          {credForm.formState.errors.email ? (
            <p className={styles.error}>
              {credForm.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="signup-password">
            {t("signup.password")}
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            className={styles.input}
            {...credForm.register("password")}
          />
          {credForm.formState.errors.password ? (
            <p className={styles.error}>
              {credForm.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <div className={styles.actions}>
          <Button type="submit" variant="primary">
            {t("signup.next")}
          </Button>
        </div>

        <p className={styles.footer}>
          {t("signup.haveAccount")}{" "}
          <Link href="/login" className={styles.link}>
            {t("signup.loginLink")}
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={usernameForm.handleSubmit(handleUsername)}
      noValidate
      aria-busy={isSubmitting}
    >
      <h1 className={styles.title}>{t("signup.title")}</h1>
      <p className={styles.subtitle}>{t("signup.step2Subtitle")}</p>

      {serverError ? (
        <p className={styles.serverError} role="alert">
          {serverError}
        </p>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="signup-username">
          {t("signup.username")}
        </label>
        <input
          id="signup-username"
          type="text"
          autoComplete="username"
          className={styles.input}
          {...usernameForm.register("username")}
        />
        {usernameForm.formState.errors.username ? (
          <p className={styles.error}>
            {usernameForm.formState.errors.username.message}
          </p>
        ) : null}
      </div>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {t("signup.submit")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting}
          onClick={() => setStep("credentials")}
        >
          {t("signup.back")}
        </Button>
      </div>
    </form>
  );
}
