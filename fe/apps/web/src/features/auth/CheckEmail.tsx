"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Text, TextAction } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { auth, AUTH_ERROR_KEY } from "@/i18n/dict/auth";
import type { AuthResult } from "./actions";
import { AUTH_ACTIONS_CLASS_NAME, AUTH_CENTER_CLASS_NAME } from "./classNames";
import { useCooldown } from "./useCooldown";

/** Props for {@link CheckEmail}. */
export type CheckEmailProps = {
  readonly text: string;
  readonly hint?: string;
  readonly resend: () => Promise<AuthResult>;
  readonly onChangeEmail?: () => void;
  readonly backHref: string;
};

/** "Check your email" body: the message, a resend button with a 60 s cooldown, and a way back. */
export const CheckEmail = ({ text, hint, resend, onChangeEmail, backHref }: CheckEmailProps) => {
  const t = useT(auth);
  const { left, start } = useCooldown(60, true);
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "affirmative" | "negative"; text: string } | null>(null);
  const onResend = () =>
    startTransition(async () => {
      const result = await resend();
      if (result.ok) {
        setNotice({ tone: "affirmative", text: t("resentText") });
        start();
      } else setNotice({ tone: "negative", text: t(AUTH_ERROR_KEY[result.code]) });
    });
  return (
    <div className={AUTH_ACTIONS_CLASS_NAME}>
      <Text>{text}</Text>
      {hint ? <Text size="sm" tone="muted">{hint}</Text> : null}
      {notice ? <Alert title={notice.tone === "affirmative" ? t("resentTitle") : t("errGeneric")} description={notice.text} tone={notice.tone} /> : null}
      <Button variant="secondary" width="fill" isPending={isPending} isDisabled={left > 0} onPress={onResend}>
        {left > 0 ? t("resendWait", { seconds: left }) : t("resend")}
      </Button>
      <div className={AUTH_CENTER_CLASS_NAME}>
        {onChangeEmail ? <TextAction onPress={onChangeEmail}>{t("wrongEmail")}</TextAction> : null}
        <TextAction href={backHref}>{t("backToSignIn")}</TextAction>
      </div>
    </div>
  );
};
