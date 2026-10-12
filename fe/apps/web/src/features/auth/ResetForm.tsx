"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Form, Input, TextAction } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { auth, AUTH_ERROR_KEY } from "@/i18n/dict/auth";
import { AuthShell } from "./AuthShell";
import { updatePassword } from "./actions";
import { AUTH_ACTIONS_CLASS_NAME, AUTH_CENTER_CLASS_NAME, AUTH_FIELDS_CLASS_NAME } from "./classNames";
import { passwordStrength } from "./password";

/** Props for {@link ResetForm}. */
export type ResetFormProps = { readonly expired: boolean };

/** Reset password: new password + confirm, or a clear "link expired" state with a way to request another. */
export const ResetForm = ({ expired }: ResetFormProps) => {
  const t = useT(auth);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [failure, setFailure] = useState<{ text: string; expired: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const strength = passwordStrength(password);
  const strengthText = password ? t(strength === "weak" ? "strengthWeak" : strength === "ok" ? "strengthOk" : "strengthStrong") : t("passwordHint");

  if (expired || failure?.expired) {
    return (
      <AuthShell label={t("resetExpiredTitle")} title={t("resetExpiredTitle")} text={t("resetExpiredText")}>
        <div className={AUTH_ACTIONS_CLASS_NAME}>
          <Button variant="primary" width="fill" href="/forgot-password">{t("resetNewLink")}</Button>
          <div className={AUTH_CENTER_CLASS_NAME}>
            <TextAction href="/login">{t("backToSignIn")}</TextAction>
          </div>
        </div>
      </AuthShell>
    );
  }

  const submit = () => {
    const found: { password?: string; confirm?: string } = {};
    if (password.length < 8) found.password = t("errPasswordShort");
    if (confirm !== password) found.confirm = t("errPasswordMismatch");
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    startTransition(async () => {
      const result = await updatePassword({ password });
      if (result && !result.ok) setFailure({ text: t(AUTH_ERROR_KEY[result.code]), expired: result.code === "link_invalid" });
    });
  };

  return (
    <AuthShell label={t("resetTitle")} title={t("resetTitle")} text={t("resetText")}>
      <Form label={t("resetTitle")} onSubmit={submit} isPending={isPending}>
        <div className={AUTH_FIELDS_CLASS_NAME}>
          {failure ? <Alert title={t("resetFailedTitle")} description={failure.text} tone="negative" /> : null}
          <Input id="reset-password" name="password" kind="newPassword" label={t("newPasswordLabel")} hint={strengthText} revealLabel={t("showPassword")} hideLabel={t("hidePassword")} variant="secondary" isRequired isDisabled={isPending} value={password} isError={Boolean(errors.password)} errorMessage={errors.password} onValueChange={setPassword} />
          <Input id="reset-confirm" name="confirm" kind="newPassword" label={t("confirmLabel")} revealLabel={t("showPassword")} hideLabel={t("hidePassword")} variant="secondary" isRequired isDisabled={isPending} value={confirm} isError={Boolean(errors.confirm)} errorMessage={errors.confirm} onValueChange={setConfirm} />
          <Button variant="primary" width="fill" type="submit" isPending={isPending}>{t("resetSubmit")}</Button>
        </div>
      </Form>
    </AuthShell>
  );
};
