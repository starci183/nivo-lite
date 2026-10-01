import { intlLocale, TIME_ZONE, type Locale, type Translate } from "@/i18n/core";
import type { responsibilities } from "@/i18n/dict/responsibilities";
import type { Agent, EventRow, LeadStage, ResponsibilityStatus, ResponsibilityWithLead } from "@/lib/types";

/** One responsibility, resolved for display. Serialisable, so a server page can hand it to a client board. */
export type ResponsibilityRowModel = {
  id: string;
  leadId: string;
  customer: string;
  title: string;
  nextAction: string;
  dueLabel: string | null;
  dueAt: string | null;
  createdAt: string;
  stage: LeadStage;
  ownerAgentId: string | null;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueThisWeek: boolean;
  status: ResponsibilityStatus;
  statusLabel: string;
  ownerKey: string;
  ownerName: string;
  ownerKind: "human" | "agent";
  ownerHandle: string | null;
};

/** The owners that hold rows, in display order. */
export type OwnerGroupModel = {
  key: string;
  name: string;
  kind: "human" | "agent";
  handle: string | null;
  rows: Array<ResponsibilityRowModel>;
};

/** One recent event, resolved for display. */
export type ActivityModel = {
  id: string;
  kind: string;
  actor: string;
  summary: string;
  timeLabel: string;
  leadId: string | null;
};

/** Translator for the responsibilities dictionary (built with getT on the server or useT on the client). */
export type RespT = Translate<typeof responsibilities.en>;

const DAY_MS = 86_400_000;

/** Status wording shared by the badge and the tabs. */
export const statusLabel = (t: RespT, status: ResponsibilityStatus): string =>
  status === "open" ? t("statusOpen") : status === "waiting_approval" ? t("statusWaiting") : t("statusDone");

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar day in the workspace time zone, as UTC midnight milliseconds. */
const dayStart = (date: Date): number => {
  const [y, m, d] = dayFormat.format(date).split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
};

const dayOffset = (due: string, now: Date): number => Math.round((dayStart(new Date(due)) - dayStart(now)) / DAY_MS);

const dueText = (t: RespT, offset: number): string => {
  if (offset < -1) return t("overdueDays", { n: -offset });
  if (offset === -1) return t("overdueYesterday");
  if (offset === 0) return t("dueToday");
  if (offset === 1) return t("dueTomorrow");
  return t("dueInDays", { n: offset });
};

/** Relative time such as "5 min ago", "3 h ago" or "2 days ago". */
export const relativeTime = (t: RespT, iso: string, now: Date): string => {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minAgo", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("hourAgo", { n: hours });
  const days = Math.round(hours / 24);
  return days === 1 ? t("yesterday") : t("daysAgo", { n: days });
};

/** Hour of day (0-23) in the workspace time zone. */
export const hourInZone = (date: Date): number =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(date));

/** Resolve responsibilities into display rows, with the owner's @handle looked up from the agents. */
export const toRowModels = (
  list: ReadonlyArray<ResponsibilityWithLead>,
  agents: ReadonlyArray<Agent>,
  now: Date,
  t: RespT,
): Array<ResponsibilityRowModel> =>
  list.map((r) => {
    const agent = r.owner_kind === "agent" ? agents.find((a) => a.id === r.owner_agent_id) : undefined;
    const isDone = r.status === "done";
    const offset = r.due_at === null || isDone ? null : dayOffset(r.due_at, now);
    const noDue = isDone ? null : t("noDue");
    return {
      id: r.id,
      leadId: r.lead_id,
      customer: `${r.lead.contact_name} · ${r.lead.company}`,
      title: r.title,
      nextAction: r.next_action,
      dueLabel: offset === null ? noDue : dueText(t, offset),
      dueAt: isDone ? null : r.due_at,
      createdAt: r.created_at,
      stage: r.lead.stage,
      ownerAgentId: r.owner_kind === "agent" ? r.owner_agent_id : null,
      isOverdue: offset !== null && offset < 0,
      isDueToday: offset === 0,
      isDueThisWeek: offset !== null && offset >= 0 && offset <= 7,
      status: r.status,
      statusLabel: statusLabel(t, r.status),
      ownerKey: r.owner_kind === "agent" ? `agent:${r.owner_agent_id ?? r.owner_name}` : `human:${r.owner_name}`,
      ownerName: agent?.name ?? r.owner_name,
      ownerKind: r.owner_kind,
      ownerHandle: agent === undefined ? null : agent.handle,
    };
  });

/** Group rows by owner. Owners with the most rows first, humans before agents on a tie. */
export const groupByOwner = (rows: ReadonlyArray<ResponsibilityRowModel>): Array<OwnerGroupModel> => {
  const groups = new Map<string, OwnerGroupModel>();
  for (const row of rows) {
    const group = groups.get(row.ownerKey);
    if (group === undefined) {
      groups.set(row.ownerKey, {
        key: row.ownerKey,
        name: row.ownerName,
        kind: row.ownerKind,
        handle: row.ownerHandle,
        rows: [row],
      });
    } else {
      group.rows.push(row);
    }
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || b.kind.localeCompare(a.kind));
};

/** Resolve events into display rows. */
export const toActivityModels = (events: ReadonlyArray<EventRow>, now: Date, t: RespT): Array<ActivityModel> =>
  events.map((e) => ({
    id: e.id,
    kind: e.kind,
    actor: e.actor,
    summary: e.summary,
    timeLabel: relativeTime(t, e.created_at, now),
    leadId: e.lead_id,
  }));

/** Short absolute stamp such as "10:00, 29 Sep", in the workspace time zone and the active language. */
export const stamp = (date: Date, locale: Locale): string => {
  const tag = intlLocale(locale);
  const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(date);
  const day = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: TIME_ZONE }).format(date);
  return `${time}, ${day}`;
};
