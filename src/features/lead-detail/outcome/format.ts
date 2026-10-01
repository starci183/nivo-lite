import type { IconName } from "@/ui";
import { intlLocale, TIME_ZONE, type Locale, type Translate } from "@/i18n/core";
import type { common as commonDict } from "@/i18n/dict/common";
import type { lead as leadDict } from "@/i18n/dict/lead";
import type { EventRow, LeadStage } from "@/lib/types";

type LeadT = Translate<(typeof leadDict)["en"]>;
type CommonT = Translate<(typeof commonDict)["en"]>;

const KIND_KEYS: Readonly<Record<string, keyof (typeof leadDict)["en"]>> = {
  "lead.captured": "kindLeadCaptured",
  "context.summarised": "kindContext",
  "responsibility.assigned": "kindAssigned",
  "execution.drafted": "kindDrafted",
  "execution.approved": "kindApproved",
  "execution.rejected": "kindRejected",
  "outcome.recorded": "kindOutcome",
  "agent.installed": "kindAgentInstalled",
  "agent.updated": "kindAgentUpdated",
};

const STAGE_KEYS: Readonly<Record<LeadStage, "stageNew" | "stageQualified" | "stageProposal" | "stageWon" | "stageLost">> = {
  new: "stageNew",
  qualified: "stageQualified",
  proposal: "stageProposal",
  won: "stageWon",
  lost: "stageLost",
};

/** Stage label from the shared dictionary. */
export const stageLabel = (stage: LeadStage, tc: CommonT): string => tc(STAGE_KEYS[stage]);

/** Human-readable label for an event kind. */
export const kindLabel = (kind: string, t: LeadT): string => {
  const key = KIND_KEYS[kind];
  return key === undefined ? kind : t(key);
};

/** Relative time such as "3 h ago", computed on the server so hydration matches. */
export const relativeTime = (iso: string, now: number, t: LeadT, locale: Locale): string => {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hourAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("dayAgo", { count: days });
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: TIME_ZONE }).format(new Date(iso));
};

export type EventView = {
  id: string;
  kind: string;
  label: string;
  actor: string;
  dateTime: string;
  timeLabel: string;
  summary: string;
  evidence: string | null;
};

/** Maps raw events to display rows, newest first. */
export const toEventViews = (events: ReadonlyArray<EventRow>, now: number, t: LeadT, locale: Locale): Array<EventView> =>
  [...events]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((event) => ({
      id: event.id,
      kind: event.kind,
      label: kindLabel(event.kind, t),
      actor: event.actor,
      dateTime: event.created_at,
      timeLabel: relativeTime(event.created_at, now, t, locale),
      summary: event.summary,
      evidence: event.evidence,
    }));

const KIND_ICONS: Readonly<Record<string, IconName>> = {
  "lead.captured": "community",
  "context.summarised": "review",
  "responsibility.assigned": "account",
  "execution.drafted": "send",
  "execution.approved": "complete",
  "execution.rejected": "close",
  "outcome.recorded": "reward",
};

/** Glyph meaning for an event kind. */
export const kindIcon = (kind: string): IconName => KIND_ICONS[kind] ?? "pending";
