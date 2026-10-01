"use client";

import { NivoIcon } from "@/ui";
import { useT } from "@/i18n/client";
import { login } from "@/i18n/dict/login";
import { AuthShell } from "@/features/auth/AuthShell";
import { Alert, Button, Form, Input, Text, TextAction } from "@starci/grammar/common";
import { auth } from "@/i18n/dict/auth";
import { LOGIN_ACTIONS_CLASS_NAME, LOGIN_CENTER_CLASS_NAME, LOGIN_FIELDS_CLASS_NAME, LOGIN_ROW_CLASS_NAME } from "./classNames";

/** Resolved facts the pure login card draws. */
export type LoginBaseData = {
  readonly showDemo: boolean;
  readonly email: string;
  readonly password: string;
  readonly emailError?: string;
  readonly passwordError?: string;
  /** Friendly, already translated failure. */
  readonly error?: string;
  readonly notice?: string;
  /** True when the failure is "email not confirmed": offer to resend. */
  readonly canResend: boolean;
  readonly isPasswordPending: boolean;
  readonly isGooglePending: boolean;
  readonly isDemoPending: boolean;
  readonly isResendPending: boolean;
  readonly signUpHref: string;
  readonly forgotHref: string;
};

/** Commands the login card reports back. */
export type LoginBaseActions = {
  readonly setEmail: (value: string) => void;
  readonly setPassword: (value: string) => void;
  readonly submit: () => void;
  readonly google: () => void;
  readonly demo: () => void;
  readonly resend: () => void;
};

/** Props for {@link LoginBase}. */
export type LoginBaseProps = { readonly props: LoginBaseData; readonly on: LoginBaseActions };

/** Draw the sign-in card: Google, e-mail + password, demo (when enabled), links to sign-up and forgot password. */
export const LoginBase = ({ props, on }: LoginBaseProps) => {
  const t = useT(login);
  const a = useT(auth);
  const busy = props.isPasswordPending || props.isGooglePending || props.isDemoPending;
  return (
    <AuthShell label={t("signInLabel")} title={t("signInTitle")} text={t("signInText")}>
      {props.notice ? <Alert title={props.notice} tone="affirmative" /> : null}
      {props.error ? (
        <Alert
          title={t("failedTitle")}
          description={props.error}
          tone="negative"
          action={props.canResend ? { label: t("resendConfirm"), onAction: on.resend } : undefined}
        />
      ) : null}
      <div className={LOGIN_ACTIONS_CLASS_NAME}>
        <Button
          variant="secondary"
          width="fill"
          isPending={props.isGooglePending}
          isDisabled={busy && !props.isGooglePending}
          startContent={<NivoIcon props={{ name: "google" }} />}
          onPress={on.google}
        >
          {t("google")}
        </Button>
        <div className={LOGIN_CENTER_CLASS_NAME}><Text size="sm" tone="muted">{t("or")}</Text></div>
      </div>
      <Form label={t("signInLabel")} onSubmit={on.submit} isPending={props.isPasswordPending}>
        <div className={LOGIN_FIELDS_CLASS_NAME}>
          <Input id="login-email" name="email" kind="email" label={a("emailLabel")} placeholder={a("emailPlaceholder")} variant="secondary" isRequired isDisabled={busy} value={props.email} isError={Boolean(props.emailError)} errorMessage={props.emailError} onValueChange={on.setEmail} />
          <Input id="login-password" name="password" kind="password" label={a("passwordLabel")} revealLabel={a("showPassword")} hideLabel={a("hidePassword")} variant="secondary" isRequired isDisabled={busy} value={props.password} isError={Boolean(props.passwordError)} errorMessage={props.passwordError} onValueChange={on.setPassword} />
          <div className={LOGIN_ROW_CLASS_NAME}>
            <span />
            <TextAction href={props.forgotHref}>{t("forgot")}</TextAction>
          </div>
          <Button variant="primary" width="fill" type="submit" isPending={props.isPasswordPending}>{t("submit")}</Button>
        </div>
      </Form>
      {props.showDemo ? (
        <Button variant="tertiary" width="fill" isPending={props.isDemoPending} isDisabled={busy && !props.isDemoPending} onPress={on.demo}>
          {t("demo")}
        </Button>
      ) : null}
      <div className={LOGIN_CENTER_CLASS_NAME}>
        <Text size="sm" tone="muted">{t("noAccount")}</Text>
        <TextAction href={props.signUpHref}>{t("signUpLink")}</TextAction>
      </div>
    </AuthShell>
  );
};
