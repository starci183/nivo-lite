"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Form, Input, TextAction } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { auth, AUTH_ERROR_KEY } from "@/i18n/dict/auth";
import { AuthShell } from "./AuthShell";
import { CheckEmail } from "./CheckEmail";
import { requestPasswordReset } from "./actions";
import { AUTH_CENTER_CLASS_NAME, AUTH_FIELDS_CLASS_NAME } from "./classNames";
import { EMAIL_PATTERN } from "./password";

/** Props for {@link ForgotForm}. */
export type ForgotFormProps = { readonly initialEmail?: string; readonly loginHref: string };

/** Forgot password: e-mail in, a generic "if the account exists" message out (no account enumeration). */
export const ForgotForm = ({ initialEmail = "", loginHref }: ForgotFormProps) => {
  const t = useT(auth);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setFailure(null);
    if (!EMAIL_PATTERN.test(email.trim())) return setError(t("errEmail"));
    setError(undefined);
    startTransition(async () => {
      const result = await requestPasswordReset({ email });
      if (result.ok) setSentTo(email.trim().toLowerCase());
      else setFailure(t(AUTH_ERROR_KEY[result.code]));
    });
  };

  if (sentTo) {
    return (
      <AuthShell label={t("forgotSentTitle")} title={t("forgotSentTitle")}>
        <CheckEmail text={t("forgotSentText", { email: sentTo })} resend={() => requestPasswordReset({ email: sentTo })} onChangeEmail={() => setSentTo(null)} backHref={loginHref} />
      </AuthShell>
    );
  }

  return (
    <AuthShell label={t("forgotTitle")} title={t("forgotTitle")} text={t("forgotText")}>
      <Form label={t("forgotTitle")} onSubmit={submit} isPending={isPending}>
        <div className={AUTH_FIELDS_CLASS_NAME}>
          {failure ? <Alert title={t("errGeneric")} description={failure} tone="negative" /> : null}
          <Input id="forgot-email" name="email" kind="email" label={t("emailLabel")} placeholder={t("emailPlaceholder")} variant="secondary" isRequired isDisabled={isPending} value={email} isError={Boolean(error)} errorMessage={error} onValueChange={setEmail} />
          <Button variant="primary" width="fill" type="submit" isPending={isPending}>{t("forgotSubmit")}</Button>
          <div className={AUTH_CENTER_CLASS_NAME}>
            <TextAction href={loginHref}>{t("backToSignIn")}</TextAction>
          </div>
        </div>
      </Form>
    </AuthShell>
  );
};
