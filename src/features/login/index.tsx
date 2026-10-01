"use client";

import { useState, useTransition } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useT } from "@/i18n/client";
import { login } from "@/i18n/dict/login";
import { auth, AUTH_ERROR_KEY, type AuthErrorCode } from "@/i18n/dict/auth";
import { resendConfirmation, signInWithPassword } from "@/features/auth/actions";
import { EMAIL_PATTERN } from "@/features/auth/password";
import { signInDemo } from "./actions";
import { LoginBase } from "./component";

/** Props for {@link Login}. */
export type LoginProps = {
  readonly showDemo: boolean;
  /** Where to go after signing in (an invite page, a deep link). */
  readonly next?: string;
  /** Machine code from /auth routes (`link_expired`, `missing_code`, ...). */
  readonly errorCode?: string;
  /** `reset` | `confirmed`: a success note from a finished flow. */
  readonly notice?: string;
};

const withNext = (path: string, next?: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);
const inviteOf = (next?: string) => (next?.startsWith("/invite/") ? next.slice("/invite/".length) : undefined);

/** Connected sign-in card: password (server action), Google OAuth (browser), demo (server action). */
export const Login = ({ showDemo, next, errorCode, notice }: LoginProps) => {
  const t = useT(login);
  const a = useT(auth);
  const initialError = errorCode === "link_expired" ? t("errLinkExpired") : errorCode === "missing_code" ? t("errMissingCode") : errorCode ? a("errGeneric") : undefined;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | undefined>(initialError);
  const [info, setInfo] = useState<string | undefined>(notice === "reset" ? t("noticeReset") : notice === "confirmed" ? t("noticeConfirmed") : undefined);
  const [canResend, setCanResend] = useState(false);
  const [isGooglePending, setGooglePending] = useState(false);
  const [isPasswordPending, startPassword] = useTransition();
  const [isDemoPending, startDemo] = useTransition();
  const [isResendPending, startResend] = useTransition();

  const fail = (code: AuthErrorCode) => {
    setError(a(AUTH_ERROR_KEY[code]));
    setCanResend(code === "email_not_confirmed");
  };
  const reset = () => {
    setError(undefined);
    setInfo(undefined);
    setCanResend(false);
  };
  const invite = inviteOf(next);

  return (
    <LoginBase
      props={{
        showDemo, email, password, error, notice: info, canResend, isPasswordPending, isGooglePending, isDemoPending, isResendPending,
        emailError: fieldErrors.email, passwordError: fieldErrors.password,
        signUpHref: invite ? `/signup?invite=${encodeURIComponent(invite)}` : "/signup",
        forgotHref: "/forgot-password",
      }}
      on={{
        setEmail,
        setPassword,
        submit: () => {
          reset();
          const found: { email?: string; password?: string } = {};
          if (!EMAIL_PATTERN.test(email.trim())) found.email = a("errEmail");
          if (!password) found.password = a("errPasswordRequired");
          setFieldErrors(found);
          if (Object.keys(found).length > 0) return;
          startPassword(async () => {
            const result = await signInWithPassword({ email, password, next });
            if (result && !result.ok) fail(result.code);
          });
        },
        google: () => {
          reset();
          setGooglePending(true);
          void supabaseBrowser()
            .auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}${withNext("/auth/callback", next)}` } })
            .then((result) => {
              if (result.error) {
                setError(a("errGeneric"));
                setGooglePending(false);
              }
            });
        },
        demo: () => {
          reset();
          startDemo(async () => {
            const outcome = await signInDemo();
            if (!outcome.ok) setError(outcome.error);
          });
        },
        resend: () => {
          if (!EMAIL_PATTERN.test(email.trim())) return setFieldErrors({ email: a("errEmail") });
          startResend(async () => {
            const result = await resendConfirmation({ email, next });
            if (result.ok) {
              reset();
              setInfo(t("confirmSent"));
            } else fail(result.code);
          });
        },
      }}
    />
  );
};
