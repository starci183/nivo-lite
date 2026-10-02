"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, SurfaceCard } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { engine as dict } from "@/i18n/dict/engine";
import { DEFAULT_REPLY_TIMEOUT_SEC } from "@/lib/engine-queue-shared";
import { STACK_CLASS_NAME } from "../classNames";
import { setHoldingMessage, setReplyTimeout } from "../processorActions";
import type { SettingsExtraProps } from "../registry";

/** Settings extra of the chatbot module: the longest a customer waits before the app answers directly, and the holding message. */
export const ChatbotReplyExtras = ({ installation, canEdit }: SettingsExtraProps) => {
  const t = useT(dict);
  const router = useRouter();
  const savedTimeout = Number(installation.settings.openclawTimeoutSec);
  const initialTimeout = Number.isFinite(savedTimeout) && savedTimeout >= 5 ? Math.round(savedTimeout) : DEFAULT_REPLY_TIMEOUT_SEC;
  const savedHolding = typeof installation.settings.holdingMessage === "string" ? installation.settings.holdingMessage : "";
  const [holdingText, setHoldingText] = useState(savedHolding);
  const [timeoutText, setTimeoutText] = useState(String(initialTimeout));
  const [note, setNote] = useState<{ ok: boolean; text: string } | undefined>();
  const [pending, startTransition] = useTransition();
  if (!canEdit) return null;

  const timeoutValue = Number(timeoutText);
  const timeoutValid = Number.isInteger(timeoutValue) && timeoutValue >= 5 && timeoutValue <= 120;
  const save = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setNote(undefined);
    startTransition(async () => {
      const r = await fn();
      setNote(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  };

  return (
    <SurfaceCard label={t("replyTitle")} headingLevel={2}>
      <div className={STACK_CLASS_NAME}>
        <Input id="reply-timeout" name="reply-timeout" label={t("timeoutLabel")} variant="secondary" hint={t("timeoutHint")} value={timeoutText} isDisabled={pending} onValueChange={(v) => setTimeoutText(v.replace(/[^0-9]/g, "").slice(0, 3))} />
        <div>
          <Button variant="secondary" isPending={pending} isDisabled={!timeoutValid || timeoutValue === initialTimeout} onPress={() => save(() => setReplyTimeout(installation.id, timeoutValue))}>{t("timeoutSave")}</Button>
        </div>
        <Input id="holding-message" name="holding-message" label={t("holdingLabel")} variant="secondary" hint={t("holdingHint")} placeholder={t("holdingDefault")} value={holdingText} isDisabled={pending} onValueChange={(v) => setHoldingText(v.slice(0, 400))} />
        <div>
          <Button variant="secondary" isPending={pending} isDisabled={holdingText.trim() === savedHolding.trim()} onPress={() => save(() => setHoldingMessage(installation.id, holdingText))}>{t("timeoutSave")}</Button>
        </div>
        {note !== undefined ? <Alert title={note.ok ? t("saved") : t("notSaved")} description={note.ok ? undefined : note.text} tone={note.ok ? "affirmative" : "negative"} /> : null}
      </div>
    </SurfaceCard>
  );
};
