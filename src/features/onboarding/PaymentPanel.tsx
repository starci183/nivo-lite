"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Alert, Button } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { onboarding } from "@/i18n/dict/onboarding";
import { newOrderAction, orderStatusAction, switchWorkspaceAction } from "./actions";
import { useMoney } from "./useMoney";
import { Stepper } from "./Stepper";
import {
  ACTIONS_CLASS_NAME, AMOUNT_CLASS_NAME, CENTER_CLASS_NAME, CODE_CHIP_CLASS_NAME, DETAILS_CLASS_NAME, DETAIL_ROW_CLASS_NAME, H1_CLASS_NAME, LIVE_CLASS_NAME,
  LIVE_DOT_CLASS_NAME, MUTED_CLASS_NAME, PAY_CARD_CLASS_NAME, QR_CLASS_NAME, QR_WRAP_CLASS_NAME, RING_TEXT_CLASS_NAME, RING_WRAP_CLASS_NAME,
  STACK_CLASS_NAME, STACK_SM_CLASS_NAME, SUCCESS_CLASS_NAME, SUCCESS_IMG_CLASS_NAME,
} from "./classNames";

/** What the payment screen needs; everything sensitive was decided on the server. */
export type PaymentPanelProps = {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly planName: string;
  readonly returnTo: string;
  readonly bank: { readonly account: string; readonly bank: string; readonly holder: string };
  /** null when there is no open order (the last one expired). */
  readonly order: { readonly id: string; readonly code: string; readonly amount: number; readonly expiresAt: string; readonly qrUrl: string } | null;
};

type Phase = "pending" | "paid" | "expired";
const POLL_MS = 3000;
const WINDOW_MS = 30 * 60 * 1000;

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const CopyButton = ({ value }: { readonly value: string }) => {
  const t = useT(onboarding);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the value stays selectable on screen.
    }
  };
  return <Button size="sm" variant={copied ? "secondary" : "outline"} onPress={copy}>{copied ? t("copied") : t("copy")}</Button>;
};

const Row = ({ label, value, children }: { readonly label: string; readonly value: string; readonly children?: React.ReactNode }) => (
  <div className={DETAIL_ROW_CLASS_NAME}>
    <div className="min-w-0">
      <p className={MUTED_CLASS_NAME}>{label}</p>
      <div className="break-words text-base font-semibold text-foreground">{children ?? value}</div>
    </div>
    <CopyButton value={value} />
  </div>
);

const Ring = ({ left, label }: { readonly left: number; readonly label: string }) => {
  const r = 28;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, left / WINDOW_MS));
  return (
    <div className={RING_WRAP_CLASS_NAME} role="timer" aria-label={label}>
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-divider" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} className="text-accent transition-[stroke-dashoffset] duration-1000 ease-linear" />
      </svg>
      <span className={RING_TEXT_CLASS_NAME}>{clock(left)}</span>
    </div>
  );
};

/** Step 3: the VietQR code, copyable bank details, a countdown, and polling until the transfer lands. */
export const PaymentPanel = ({ workspaceId, workspaceName, planName, returnTo, bank, order }: PaymentPanelProps) => {
  const t = useT(onboarding);
  const money = useMoney();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(order ? "pending" : "expired");
  const [left, setLeft] = useState<number | null>(order ? new Date(order.expiresAt).getTime() - Date.now() : null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const orderId = order?.id;
  const expiresAt = order?.expiresAt;

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
        if (status === "paid") setPhase("paid");
        else if (status === "expired" || status === "cancelled") setPhase("expired");
      } catch {
        // Network blip: the next poll retries.
      }
    }, POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [orderId, expiresAt, phase]);

  useEffect(() => {
    if (phase !== "paid") return;
    const go = setTimeout(async () => {
      // The paid workspace becomes the current one before the console opens.
      await switchWorkspaceAction(workspaceId).catch(() => undefined);
      router.push(returnTo);
      router.refresh();
    }, 1800);
    return () => clearTimeout(go);
  }, [phase, returnTo, router, workspaceId]);

  const regenerate = () => {
    setError(null);
    start(async () => {
      const res = await newOrderAction(workspaceId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  const configured = Boolean(bank.account && bank.bank);
  const steps = [t("stepPlan"), t("stepWorkspace"), t("stepPayment")];

  if (phase === "paid") {
    return (
      <div className={CENTER_CLASS_NAME}>
        <Stepper steps={steps} current={3} label={t("payTitle")} />
        <div className={SUCCESS_CLASS_NAME} role="status">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={SUCCESS_IMG_CLASS_NAME} src="/images/promo/mascot-celebrate.png" alt="" />
          <div className={STACK_SM_CLASS_NAME}>
            <h1 className={H1_CLASS_NAME}>{t("paidTitle")}</h1>
            <p className={MUTED_CLASS_NAME}>{t("paidText")}</p>
          </div>
          <Button variant="primary" size="lg" href={returnTo}>{t("toWorkspace")}</Button>
        </div>
      </div>
    );
  }

  if (phase === "expired" || !order) {
    return (
      <div className={CENTER_CLASS_NAME}>
        <Stepper steps={steps} current={3} label={t("payTitle")} />
        <div className={SUCCESS_CLASS_NAME}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="h-40 w-auto select-none" src="/images/promo/mascot-night.png" alt="" />
          <div className={STACK_SM_CLASS_NAME}>
            <h1 className={H1_CLASS_NAME}>{t("expiredTitle")}</h1>
            <p className={MUTED_CLASS_NAME}>{t("expiredText")}</p>
          </div>
          {error ? <Alert tone="negative" title={t("errGeneric")} description={error} /> : null}
          <div className={ACTIONS_CLASS_NAME}>
            <Button variant="primary" size="lg" isPending={isPending} onPress={regenerate}>{t("regenerate")}</Button>
            <Button variant="ghost" href="/workspaces">{t("allWorkspaces")}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={CENTER_CLASS_NAME}>
      <Stepper steps={steps} current={3} label={t("payTitle")} />
      <div className={STACK_SM_CLASS_NAME}>
        <h1 className={H1_CLASS_NAME}>{t("payTitle")}</h1>
        <p className={MUTED_CLASS_NAME}>{[workspaceName, planName].filter(Boolean).join(" · ")}</p>
      </div>
      <div className={PAY_CARD_CLASS_NAME}>
        <div className={QR_WRAP_CLASS_NAME}>
          <p className="m-0 text-sm font-medium text-foreground">{t("scanTitle")}</p>
          {configured ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={QR_CLASS_NAME} src={order.qrUrl} alt={t("qrAlt")} width={256} height={256} />
          ) : (
            <Alert tone="cautionary" title={t("notConfigured")} />
          )}
          {left !== null ? (
            <div className="flex items-center gap-3">
              <Ring left={left} label={t("expiresIn", { time: clock(left) })} />
              <p className={MUTED_CLASS_NAME}>{t("expiresIn", { time: clock(left) })}</p>
            </div>
          ) : null}
        </div>
        <div className={STACK_CLASS_NAME}>
          <div className={STACK_SM_CLASS_NAME}>
            <p className={MUTED_CLASS_NAME}>{t("amount")}</p>
            <p className={AMOUNT_CLASS_NAME}>{money(order.amount)}</p>
          </div>
          <div className={DETAILS_CLASS_NAME}>
            <Row label={t("bank")} value={bank.bank} />
            <Row label={t("account")} value={bank.account} />
            <Row label={t("holder")} value={bank.holder} />
            <Row label={t("content")} value={order.code}><span className={CODE_CHIP_CLASS_NAME}>{order.code}</span></Row>
          </div>
          <p className={MUTED_CLASS_NAME}>{t("contentWarn")}</p>
          <div className={LIVE_CLASS_NAME} role="status" aria-live="polite">
            <span className={LIVE_DOT_CLASS_NAME} aria-hidden="true" />
            {t("waiting")}
          </div>
          <p className={MUTED_CLASS_NAME}>{t("trust")}</p>
        </div>
      </div>
    </div>
  );
};
