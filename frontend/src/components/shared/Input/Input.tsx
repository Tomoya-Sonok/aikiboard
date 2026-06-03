import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

// label + input + error/hint をまとめた汎用テキスト入力。
// React Hook Form の register をそのまま spread できるよう forwardRef する。
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, name, ...rest },
  ref,
) {
  const inputId = id ?? name;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        ref={ref}
        className={`${styles.input} ${error ? styles.inputError : ""}`}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {hint && !error ? <p className={styles.hint}>{hint}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
});
