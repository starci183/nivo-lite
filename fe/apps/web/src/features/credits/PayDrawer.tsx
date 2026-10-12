"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Drawer, Image, Input, MediaFrame, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale } from "@/i18n/core";
import { credits as dict } from "@/i18n/dict/credits";
import { orderStatusAction } from "@/features/onboarding/actions";
import { COPY_CLASS_NAME, PAY_CLASS_NAME, QR_CLASS_NAME, QR_WRAP_CLASS_NAME } from "./classNames";
import type { CreditsData, PayOrder } from "./types";

/** What is being paid for: a pack of credits or an upgrade to a plan. */
export type PayTarget =
  | { readonly kind: "topup"; readonly packCode: string; readonly credits: number }
  | { readonly kind: "upgrade"; readonly planCode: string; readonly planName: string; readonly price: number };

export type PayDrawerProps = {
  readonly target: PayTarget | null;
  readonly order: PayOrder | null;
  readonly bank: CreditsData["bank"];
  readonly isRegenerating: boolean;
  readonly regenerateError: string | null;
  readonly onRegenerate: () => void;
  /** The transfer landed: the page behind re-reads the balance. */
  readonly onPaid: () => void;
  readonly onClose: () => void;
};

type Phase = "pending" | "paid" | "expired";
const POLL_MS = 3000;

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** One transfer detail: read-only and copyable. */
const Detail = ({ id, label, value }: { readonly id: string; readonly label: string; readonly value: string }) => {
  const t = useT(dict);
  return <Input id={id} name={id} label={label} variant="secondary" value={value} isReadOnly isCopyable copyLabel={t("copy")} copiedLabel={t("copied")} />;
};

/**
 * The same VietQR transfer screen as the plan payment (code, copyable bank details, countdown, polling the order until the SePay
 * webhook marks it paid), in a Drawer. The order is created and priced on the server; this only displays and polls it.
 */
export const PayDrawer = ({ target, order, bank, isRegenerating, regenerateError, onRegenerate, onPaid, onClose }: PayDrawerProps) => {
  const t = useT(dict);
  const locale = useLocale();
  const money = (n: number) => `${new Intl.NumberFormat(intlLocale(locale)).format(n)}đ`;
  const [phase, setPhase] = useState<Phase>("pending");
  const [left, setLeft] = useState<number | null>(null);
  const orderId = order?.id;
  const expiresAt = order?.expiresAt;

  // A new order starts a new wait.
  useEffect(() => {
    setPhase("pending");
    setLeft(expiresAt ? new Date(expiresAt).getTime() - Date.now() : null);
  }, [orderId, expiresAt]);

  useEffect(() => {
    if (!orderId || !expiresAt || phase !== "pending") return;
    const end = new Date(expiresAt).getTime();
    const tick = setInterval(() => {
      const rest = end - Date.now();
      setLeft(rest);
      if (rest <= 0) setPhase("expired");
    }, 1000);
    const poll = setInterval(async () => {
      try {
        const { status } = await orderStatusAction(orderId);
        if (status === "paid") {
          setPhase("paid");
          onPaid();
        } else if (status === "expired" || status === "cancelled") {
          setPhase("expired");
        }
      } catch {
        // Network blip: the next poll retries.
      }
    }, POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [orderId, expiresAt, phase, onPaid]);

  const title = target?.kind === "upgrade" ? t("payUpgrade", { plan: target.planName }) : t("payTopup", { credits: target?.kind === "topup" ? new Intl.NumberFormat(intlLocale(locale)).format(target.credits) : "" });
  const configured = Boolean(bank.account && bank.bank);
  const footer = <Button variant="secondary" onPress={onClose}>{t("close")}</Button>;

  return (
    <Drawer title={title} description={t("payText")} isOpen={target !== null} onOpenChange={(open) => { if (!open) onClose(); }} closeLabel={t("close")} placement="right" footer={footer}>
      {phase === "paid" ? (
        <Alert
          tone="affirmative"
          title={t("paidTitle")}
          description={target?.kind === "upgrade" ? t("paidUpgrade", { plan: target.planName }) : t("paidTopup", { credits: target?.kind === "topup" ? new Intl.NumberFormat(intlLocale(locale)).format(target.credits) : "" })}
        />
      ) : phase === "expired" || !order ? (
        <div className={PAY_CLASS_NAME}>
          <Alert tone="cautionary" title={t("expiredTitle")} description={t("expiredText")} />
          {regenerateError ? <Alert tone="negative" title={t("errGeneric")} description={regenerateError} /> : null}
          <div><Button variant="secondary" isPending={isRegenerating} onPress={onRegenerate}>{t("regenerate")}</Button></div>
        </div>
      ) : (
        <div className={PAY_CLASS_NAME}>
          <div className={QR_WRAP_CLASS_NAME}>
            <Text size="sm" weight="medium">{t("scan")}</Text>
            {configured ? (
              <div className={QR_CLASS_NAME}>
                <MediaFrame aspect="square" fit="contain">
                  <Image src={order.qrUrl} alt={t("qrAlt")} width={256} height={256} aspect="square" fit="contain" />
                </MediaFrame>
              </div>
            ) : (
              <Alert tone="cautionary" title={t("notConfigured")} />
            )}
            {left !== null ? <Text size="sm" tone="muted">{t("expiresIn", { time: clock(left) })}</Text> : null}
          </div>
          <div className={COPY_CLASS_NAME}>
            <Text size="sm" tone="muted">{t("amount")}</Text>
            <Text size="metric-lead" weight="semibold">{money(order.amount)}</Text>
            {order.credit !== undefined && order.daysLeft !== undefined && target?.kind === "upgrade" ? (
              <Text size="sm" tone="muted">{t("prorationNote", { plan: target.planName, price: money(target.price), credit: money(order.credit), days: order.daysLeft })}</Text>
            ) : null}
          </div>
          <Detail id="credits-pay-bank" label={t("bank")} value={bank.bank} />
          <Detail id="credits-pay-account" label={t("account")} value={bank.account} />
          <Detail id="credits-pay-holder" label={t("holder")} value={bank.holder} />
          <Detail id="credits-pay-content" label={t("content")} value={order.code} />
          <Text size="sm" tone="muted">{t("contentWarn")}</Text>
          <Alert tone="pending" title={t("waiting")} urgency="polite" />
        </div>
      )}
    </Drawer>
  );
};
