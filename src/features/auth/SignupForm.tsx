"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Form, Input, Text, TextAction } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { auth, AUTH_ERROR_KEY } from "@/i18n/dict/auth";
import { AuthShell } from "./AuthShell";
import { CheckEmail } from "./CheckEmail";
import { resendConfirmation, signUpWithPassword } from "./actions";
import { AUTH_CENTER_CLASS_NAME, AUTH_FIELDS_CLASS_NAME } from "./classNames";
import { EMAIL_PATTERN, passwordStrength } from "./password";

/** Props for {@link SignupForm}. */
export type SignupFormProps = { readonly next?: string; readonly invited: boolean; readonly initialEmail?: string; readonly loginHref: string };

type Errors = Partial<Record<"name" | "email" | "password" | "confirm", string>>;

/** Sign-up: name, e-mail, password + confirm with a strength hint; then the "check your email" screen. */
export const SignupForm = ({ next, invited, initialEmail = "", loginHref }: SignupFormProps) => {
  const t = useT(auth);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const strength = passwordStrength(password);
  const strengthText = password ? t(strength === "weak" ? "strengthWeak" : strength === "ok" ? "strengthOk" : "strengthStrong") : t("passwordHint");

  const submit = () => {
    const found: Errors = {};
    if (name.trim().length < 2) found.name = t("errName");
    if (!EMAIL_PATTERN.test(email.trim())) found.email = t("errEmail");
    if (password.length < 8) found.password = t("errPasswordShort");
    if (confirm !== password) found.confirm = t("errPasswordMismatch");
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    startTransition(async () => {
      const result = await signUpWithPassword({ name, email, password, next });
      if (!result) return; // the action redirected (signed in without confirmation)
      if (result.ok) setSentTo(email.trim().toLowerCase());
      else setFailure(t(AUTH_ERROR_KEY[result.code]));
    });
  };

  if (sentTo) {
    return (
      <AuthShell label={t("checkTitle")} title={t("checkTitle")}>
        <CheckEmail
          text={t("checkText", { email: sentTo })}
          hint={t("checkHint")}
          resend={() => resendConfirmation({ email: sentTo, next })}
          onChangeEmail={() => setSentTo(null)}
          backHref={loginHref}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell label={t("signUpTitle")} title={t("signUpTitle")} text={invited ? t("signUpInviteText") : t("signUpText")}>
      <Form label={t("signUpTitle")} onSubmit={submit} isPending={isPending}>
        <div className={AUTH_FIELDS_CLASS_NAME}>
          {failure ? <Alert title={t("signUpFailedTitle")} description={failure} tone="negative" /> : null}
          <Input id="signup-name" name="name" label={t("nameLabel")} variant="secondary" isRequired isDisabled={isPending} value={name} isError={Boolean(errors.name)} errorMessage={errors.name} onValueChange={setName} />
          <Input id="signup-email" name="email" kind="email" label={t("emailLabel")} placeholder={t("emailPlaceholder")} variant="secondary" isRequired isDisabled={isPending} value={email} isError={Boolean(errors.email)} errorMessage={errors.email} onValueChange={setEmail} />
          <Input id="signup-password" name="password" kind="newPassword" label={t("passwordLabel")} hint={strengthText} revealLabel={t("showPassword")} hideLabel={t("hidePassword")} variant="secondary" isRequired isDisabled={isPending} value={password} isError={Boolean(errors.password)} errorMessage={errors.password} onValueChange={setPassword} />
          <Input id="signup-confirm" name="confirm" kind="newPassword" label={t("confirmLabel")} revealLabel={t("showPassword")} hideLabel={t("hidePassword")} variant="secondary" isRequired isDisabled={isPending} value={confirm} isError={Boolean(errors.confirm)} errorMessage={errors.confirm} onValueChange={setConfirm} />
          <Button variant="primary" width="fill" type="submit" isPending={isPending}>{t("signUpSubmit")}</Button>
          <div className={AUTH_CENTER_CLASS_NAME}>
            <Text size="sm" tone="muted">{t("haveAccount")}</Text>
            <TextAction href={loginHref}>{t("signInLink")}</TextAction>
          </div>
        </div>
      </Form>
    </AuthShell>
  );
};
