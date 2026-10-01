import { TIME_ZONE } from "@/i18n/core";
import type { BadgeTone } from "@starci/grammar/common";

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: TIME_ZONE });

export const fmtDateTime = (iso: string | null | undefined): string => (iso ? dateTime.format(new Date(iso)) : "—");
export const fmtDate = (iso: string | null | undefined): string => (iso ? dateOnly.format(new Date(iso)) : "—");
export const fmtVnd = (n: number | null | undefined): string => `${new Intl.NumberFormat("en-US").format(Number(n ?? 0))} ₫`;

/** "5 min ago" / "3 d ago": for last-seen columns. */
export const ago = (iso: string | null | undefined, now = Date.now()): string => {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
};

/** Billing status of a workspace. */
export const STATUS_TONE: Record<string, BadgeTone> = { active: "success", pending_payment: "warning", past_due: "danger", cancelled: "neutral" };
/** Module installation status. */
export const MODULE_TONE: Record<string, BadgeTone> = { live: "success", ready: "accent", setup: "warning", installing: "neutral", paused: "neutral" };
/** Connection health. */
export const HEALTH_TONE: Record<string, BadgeTone> = { ok: "success", error: "danger", silent: "warning" };
/** Payment order / SePay transfer / job status. */
export const FLOW_TONE: Record<string, BadgeTone> = {
  paid: "success", pending: "warning", expired: "neutral", cancelled: "neutral", received: "neutral", underpaid: "danger", unmatched: "danger", ignored: "neutral",
  queued: "warning", running: "accent", done: "success", failed: "danger",
};
