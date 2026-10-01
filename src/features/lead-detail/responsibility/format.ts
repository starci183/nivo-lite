import { intlLocale, TIME_ZONE, type Locale, type Translate } from "@/i18n/core";
import type { lead as leadDict } from "@/i18n/dict/lead";
import type { Responsibility, ResponsibilityStatus } from "@/lib/types";

type LeadT = Translate<(typeof leadDict)["en"]>;

const DAY_MS = 86_400_000;

/** Human label of a responsibility status. */
export const statusLabel = (status: ResponsibilityStatus, t: LeadT): string =>
  status === "open" ? t("statusOpen") : status === "waiting_approval" ? t("statusWaiting") : t("statusDone");

/** Resolved due-date facts for display. */
export type DueFacts = {
  readonly date: string;
  readonly relative: string;
  readonly isOverdue: boolean;
};

const utcDay = (date: Date): number => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const plural = (count: number, t: LeadT): string => (count === 1 ? t("dayOne") : t("dayMany", { count }));

/** Date + relative wording for a due timestamp, compared by UTC calendar day. Null when there is no due date. */
export const dueFacts = (dueAt: string | null, t: LeadT, locale: Locale, now: Date = new Date()): DueFacts | null => {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const diff = Math.round((utcDay(due) - utcDay(now)) / DAY_MS);
  const date = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: TIME_ZONE }).format(due);
  if (diff === 0) return { date, relative: t("dueToday"), isOverdue: false };
  if (diff > 0) return { date, relative: t("dueIn", { days: plural(diff, t) }), isOverdue: false };
  return { date, relative: t("overdueBy", { days: plural(-diff, t) }), isOverdue: true };
};

/** Splits responsibilities into the current one (latest not done, else latest) and the earlier ones, newest first. */
export const splitResponsibilities = (
  all: ReadonlyArray<Responsibility>,
): { readonly current: Responsibility | null; readonly previous: ReadonlyArray<Responsibility> } => {
  const sorted = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const current = sorted.find((item) => item.status !== "done") ?? sorted[0] ?? null;
  return { current, previous: sorted.filter((item) => item !== current) };
};

/** Date-only value (yyyy-mm-dd) of a due timestamp for the date field. */
export const dateOnly = (dueAt: string | null): string | null => (dueAt ? dueAt.slice(0, 10) : null);

/** Storage value for a picked date: noon UTC so every timezone shows the same day. */
export const dueFromDate = (date: string | null): string | null => (date ? `${date}T12:00:00.000Z` : null);
