"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/shared/Button/Button";
import { Input } from "@/components/shared/Input/Input";
import {
  type DojoMaster,
  DojoMasterSelect,
} from "../DojoMasterSelect/DojoMasterSelect";
import styles from "./BoardCreateForm.module.css";

export type BoardCreateValues = {
  name: string;
  slug: string;
  isPublic: boolean;
  description?: string;
  dojoMasterIds: string[];
};

type BoardCreateFormProps = {
  onSubmit: (values: BoardCreateValues) => void | Promise<void>;
  searchDojos: (query: string) => Promise<DojoMaster[]>;
  isSubmitting?: boolean;
  serverError?: string | null;
};

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

type Translate = (key: string) => string;

function createSchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .min(1, t("validation.nameRequired"))
      .max(50, t("validation.nameMax")),
    slug: z
      .string()
      .min(3, t("validation.slugMin"))
      .max(63, t("validation.slugMax"))
      .regex(slugRegex, t("validation.slugFormat")),
    isPublic: z.boolean(),
    description: z.string().max(500, t("validation.descriptionMax")).optional(),
  });
}

type FormValues = {
  name: string;
  slug: string;
  isPublic: boolean;
  description?: string;
};

export function BoardCreateForm({
  onSubmit,
  searchDojos,
  isSubmitting = false,
  serverError = null,
}: BoardCreateFormProps) {
  const t = useTranslations("boards.create");
  const schema = useMemo(() => createSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "", isPublic: true, description: "" },
  });

  const [dojo, setDojo] = useState<DojoMaster | null>(null);
  const [dojoError, setDojoError] = useState<string | null>(null);

  const submit = async (values: FormValues) => {
    if (!dojo) {
      setDojoError(t("validation.dojoRequired"));
      return;
    }
    setDojoError(null);
    await onSubmit({ ...values, dojoMasterIds: [dojo.id] });
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit(submit)}
      noValidate
      aria-busy={isSubmitting}
    >
      <div className={styles.header}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
      </div>

      {serverError ? (
        <p className={styles.serverError} role="alert">
          {serverError}
        </p>
      ) : null}

      <Input
        label={t("name")}
        placeholder={t("namePlaceholder")}
        error={errors.name?.message}
        required
        {...register("name")}
      />

      <Input
        label={t("slug")}
        placeholder={t("slugPlaceholder")}
        hint={t("slugHint")}
        error={errors.slug?.message}
        required
        {...register("slug")}
      />

      <DojoMasterSelect
        label={t("dojo")}
        value={dojo}
        onChange={(selected) => {
          setDojo(selected);
          setDojoError(null);
        }}
        searchDojos={searchDojos}
        error={dojoError ?? undefined}
        required
      />

      <div className={styles.field}>
        <label className={styles.label} htmlFor="board-description">
          {t("description")}
        </label>
        <textarea
          id="board-description"
          className={styles.textarea}
          rows={3}
          {...register("description")}
        />
        {errors.description ? (
          <p className={styles.error}>{errors.description.message}</p>
        ) : null}
      </div>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
