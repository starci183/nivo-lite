import type { LeadStage } from "@/lib/types";
import { DEFAULT_LOCALE, intlLocale, TIME_ZONE, type Locale } from "@/i18n/core";

/** Format an ISO timestamp as a stable, timezone-fixed label in the reader's locale (default vi). */
export const formatCaptured = (iso: string, locale: Locale = DEFAULT_LOCALE): string =>
  new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso));

/** Dictionary key (leads dict) of the label for a lead stage. */
export const STAGE_KEY = {
  new: "stageNew",
  qualified: "stageQualified",
  proposal: "stageProposal",
  won: "stageWon",
  lost: "stageLost",
} as const satisfies Record<LeadStage, string>;

/** Badge tone for a lead stage. */
export const STAGE_TONE: Record<LeadStage, "neutral" | "accent" | "warning" | "success" | "danger"> = {
  new: "neutral",
  qualified: "accent",
  proposal: "warning",
  won: "success",
  lost: "danger",
};
