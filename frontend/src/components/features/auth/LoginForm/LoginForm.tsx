"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/shared/Button/Button";
import { Link } from "@/lib/i18n/routing";
import { createLoginSchema, type LoginFormValues } from "@/lib/validation/auth";
import styles from "../authForm.module.css";

type LoginFormProps = {
  onSubmit: (values: LoginFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  serverError?: string | null;
};

export function LoginForm({
  onSubmit,
  isSubmitting = false,
  serverError = null,
}: LoginFormProps) {
  const t = useTranslations("auth");
  const schema = useMemo(() => createLoginSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-busy={isSubmitting}
    >
      <h1 className={styles.title}>{t("login.title")}</h1>

      {serverError ? (
        <p className={styles.serverError} role="alert">
          {serverError}
        </p>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-email">
          {t("login.email")}
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          className={styles.input}
          {...register("email")}
        />
        {errors.email ? (
          <p className={styles.error}>{errors.email.message}</p>
        ) : null}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="login-password">
          {t("login.password")}
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className={styles.input}
          {...register("password")}
        />
        {errors.password ? (
          <p className={styles.error}>{errors.password.message}</p>
        ) : null}
      </div>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {t("login.submit")}
        </Button>
      </div>

      <p className={styles.footer}>
        {t("login.noAccount")}{" "}
        <Link href="/signup" className={styles.link}>
          {t("login.signupLink")}
        </Link>
      </p>
    </form>
  );
}
