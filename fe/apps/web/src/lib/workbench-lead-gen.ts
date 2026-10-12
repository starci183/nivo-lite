import "server-only";
import { drainAfter, engineCtx } from "./flow-ctx";
import { isTestRunName, listWorkItems } from "./flow-queries";
import type { WorkItemView, WorkStatus } from "./flow-types";
import type { Lead } from "./types";

/**
 * Data for the Lead Gen workbench. Read from the tables the flow already writes (leads, work_items, agent_conversations, agent_messages).
 * Source metadata (platform, kind, post / ad / form) is not a column of `leads`: capture_lead keeps it in the `proposal.fields` of its work item,
 * and that shape is still being extended, so every field below is read defensively from several candidate keys and falls back to the lead's channel label.
 */

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;
const CONVERSION_WINDOW_DAYS = 90;
const REPLY_WINDOW_DAYS = 30;
const OPEN_STAGES: ReadonlyArray<string> = ["new", "qualified", "proposal"];
const MAX_LEADS = 500;
const MAX_LEAD_ROWS = 100;

export type LeadPlatform = "facebook" | "instagram" | "other";
export type LeadSourceKind = "lead_ad" | "dm" | "comment" | "mention" | "other";
export type LeadScore = "hot" | "warm" | "cold";
/** Where a lead came from: the platform, how it arrived and the post / ad / form it is attributed to (null when the capture did not record one). */
export type LeadOrigin = {
  platform: LeadPlatform;
  kind: LeadSourceKind;
  refKind: "post" | "ad" | "form" | null;
  refId: string | null;
  /** A readable name of the post, ad or form when the capture stored one. */
  refLabel: string | null;
};

export type LeadGenLead = {
  id: string;
  name: string;
  stage: string;
  score: LeadScore | null;
  origin: LeadOrigin;
  lastText: string;
  lastAt: string;
  createdAt: string;
  href: string;
};

export type LeadGenSource = {
  key: string;
  origin: LeadOrigin;
  leads: number;
  hot: number;
  won: number;
};

export type LeadGenComment = {
  workItemId: string;
  platform: LeadPlatform;
  author: string;
  comment: string;
  draft: string;
  refLabel: string | null;
  at: string;
};

export type LeadGenHandoff = {
  key: string;
  leadId: string;
  name: string;
  score: LeadScore | null;
  at: string;
  /** Status of the sales classify_lead work item; null when Sales has not been given one yet. */
  classify: WorkStatus | null;
  stage: string;
  href: string;
};

export type LeadGenMetrics = {
  newToday: number;
  hotWaiting: number;
  /** Median minutes from a person's first message to the first reply, last 30 days; null with no data. */
  firstReplyP50Min: number | null;
  firstReplySample: number;
  conversionWindowDays: number;
  conversionLeads: number;
  conversionWon: number;
};

export type LeadGenWorkbenchData = {
  metrics: LeadGenMetrics;
  leads: ReadonlyArray<LeadGenLead>;
  leadsHidden: number;
  sources: ReadonlyArray<LeadGenSource>;
  comments: ReadonlyArray<LeadGenComment>;
  handoffs: ReadonlyArray<LeadGenHandoff>;
};

/* ------------------------------------------------------------------ defensive readers */

type Fields = Record<string, unknown>;

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const firstText = (f: Fields, keys: ReadonlyArray<string>): string => {
  for (const k of keys) {
    const v = text(f[k]);
    if (v) return v;
  }
  return "";
};
const fieldsOf = (w: Pick<WorkItemView, "proposal">): Fields => (w.proposal?.fields ?? {}) as Fields;
const clip = (s: string, n = 140): string => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

const platformOf = (...hints: ReadonlyArray<string>): LeadPlatform => {
  const h = hints.join(" ").toLowerCase();
  if (h.includes("instagram") || /\big\b/.test(h)) return "instagram";
  if (h.includes("facebook") || h.includes("messenger") || h.includes("meta")) return "facebook";
  return "other";
};

const kindOf = (raw: string, channelLabel: string): LeadSourceKind => {
  const h = `${raw} ${channelLabel}`.toLowerCase();
  if (/lead[\s_-]?ad|leadgen|form/.test(h)) return "lead_ad";
  if (/comment|bình luận/.test(h)) return "comment";
  if (/mention|nhắc/.test(h)) return "mention";
  if (/\bdm\b|message|messenger|inbox|postback|tin nhắn/.test(h)) return "dm";
  return "other";
};

const scoreOf = (v: unknown): LeadScore | null => {
  const s = text(v).toLowerCase();
  if (s === "hot" || s === "nóng" || s === "nong") return "hot";
  if (s === "warm" || s === "ấm" || s === "am") return "warm";
  if (s === "cold" || s === "lạnh" || s === "lanh") return "cold";
  return null;
};
const SCORE_KEYS = ["score", "lead_score", "temperature", "rating", "grade"] as const;
const scoreFromFields = (f: Fields): LeadScore | null => {
  for (const k of SCORE_KEYS) {
    const s = scoreOf(f[k]);
    if (s) return s;
  }
  return null;
};

const originOf = (f: Fields, channelLabel: string, fallbackChannel: string): LeadOrigin => {
  const label = channelLabel || fallbackChannel;
  const platform = platformOf(firstText(f, ["platform", "network"]), label, fallbackChannel);
  const kind = kindOf(firstText(f, ["source_kind", "source_type", "capture_kind", "kind", "reason", "source"]), label);
  const post = firstText(f, ["post_id", "media_id", "post"]);
  const ad = firstText(f, ["ad_id", "ad"]);
  const form = firstText(f, ["form_id", "leadgen_form_id", "form"]);
  const refKind = ad ? "ad" : form ? "form" : post ? "post" : null;
  const refId = ad || form || post || null;
  const refLabel = firstText(f, ["source_label", "post_title", "post_name", "ad_name", "form_name", "campaign_name"]) || null;
  return { platform, kind, refKind, refId, refLabel };
};

/** Work items of a lead, newest first, by action. */
const latestBy = (items: ReadonlyArray<WorkItemView>, action: string): Map<string, WorkItemView> => {
  const out = new Map<string, WorkItemView>();
  for (const w of items) if (w.action === action && w.lead_id && !out.has(w.lead_id)) out.set(w.lead_id, w);
  return out;
};

const vnDayStart = (now: number): number => Math.floor((now + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS;
const median = (xs: ReadonlyArray<number>): number | null => {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

type ConversationRow = { id: string; lead_id: string | null };
type MessageRow = { conversation_id: string; role: "user" | "agent" | "system"; body: string; created_at: string };

/**
 * Load the Lead Gen workbench for the signed-in workspace. A failed read throws: the route's RouteError shows it. With `installationId`
 * (one Lead-gen agent per page or ad account) only that instance's prospects and work items count (installation_id on leads and work items).
 */
export const getLeadGenWorkbench = async (installationId: string | null = null): Promise<LeadGenWorkbenchData> => {
  const c = await engineCtx();
  const { db, ws } = c;
  drainAfter(c);
  const nowMs = Date.now();

  const [leadsRes, items] = await Promise.all([
    db.from("leads").select("*").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(MAX_LEADS),
    listWorkItems({ limit: 600 }),
  ]);
  if (leadsRes.error) throw new Error(leadsRes.error.message);
  const ownLead = (l: Lead): boolean => installationId === null || (l as Lead & { installation_id?: string | null }).installation_id === installationId;
  const allLeads = ((leadsRes.data ?? []) as Array<Lead>).filter(ownLead);

  const leadGenItems = items.filter((w) => w.department === "lead_gen" && (installationId === null || w.installation_id === installationId));
  const capture = latestBy(leadGenItems, "capture_lead");
  const scoring = latestBy(leadGenItems, "score_lead");
  const handoffItem = latestBy(leadGenItems, "handoff_to_sales");
  const classify = latestBy(items.filter((w) => w.action === "classify_lead"), "classify_lead");

  /* A Lead Gen lead: captured by the agent, or arrived on a Meta channel. */
  const isMeta = (l: Lead): boolean => platformOf(l.channel) !== "other";
  const leads = allLeads.filter((l) => !isTestRunName(l.contact_name, l.company) && (capture.has(l.id) || handoffItem.has(l.id) || scoring.has(l.id) || isMeta(l)));
  const leadIds = leads.map((l) => l.id);

  /* Conversations and messages of these leads: last message, first-reply time. */
  const convRows = leadIds.length
    ? ((await db.from("agent_conversations").select("id, lead_id").eq("workspace_id", ws).eq("kind", "customer").in("lead_id", leadIds).limit(1000)).data ?? []) as Array<ConversationRow>
    : [];
  const convIds = convRows.map((r) => r.id);
  const leadOfConv = new Map(convRows.map((r) => [r.id, r.lead_id]));
  const since = new Date(nowMs - CONVERSION_WINDOW_DAYS * DAY_MS).toISOString();
  const msgs = convIds.length
    ? ((await db.from("agent_messages").select("conversation_id, role, body, created_at").eq("workspace_id", ws).in("conversation_id", convIds).gte("created_at", since).order("created_at", { ascending: true }).limit(8000)).data ?? []) as Array<MessageRow>
    : [];
  const byConv = new Map<string, Array<MessageRow>>();
  for (const m of msgs) {
    const list = byConv.get(m.conversation_id);
    if (list) list.push(m);
    else byConv.set(m.conversation_id, [m]);
  }
  const lastByLead = new Map<string, { text: string; at: string }>();
  const replyCut = new Date(nowMs - REPLY_WINDOW_DAYS * DAY_MS).toISOString();
  const replyDeltas: Array<number> = [];
  for (const [convId, list] of byConv) {
    const talk = list.filter((m) => m.role !== "system");
    const leadId = leadOfConv.get(convId);
    const last = talk.at(-1);
    if (leadId && last) {
      const cur = lastByLead.get(leadId);
      if (!cur || last.created_at > cur.at) lastByLead.set(leadId, { text: clip(last.body), at: last.created_at });
    }
    const firstUser = talk.find((m) => m.role === "user");
    const firstReply = firstUser ? talk.find((m) => m.role === "agent" && m.created_at > firstUser.created_at) : undefined;
    if (firstUser && firstReply && firstUser.created_at >= replyCut) replyDeltas.push((Date.parse(firstReply.created_at) - Date.parse(firstUser.created_at)) / 60_000);
  }

  /* One row per lead. */
  const rows: Array<LeadGenLead> = leads.map((l) => {
    const cap = capture.get(l.id);
    const f = cap ? fieldsOf(cap) : {};
    const sc = scoring.get(l.id);
    const score = (sc ? scoreFromFields(fieldsOf(sc)) : null) ?? scoreFromFields(f);
    const last = lastByLead.get(l.id);
    return {
      id: l.id, name: l.contact_name, stage: l.stage, score,
      origin: originOf(f, text(f.channel_label), l.channel),
      lastText: last?.text ?? clip(l.need), lastAt: last?.at ?? l.created_at, createdAt: l.created_at, href: `/leads/${l.id}`,
    };
  });
  rows.sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  /* Sources: per post / ad / form (or per way of arrival when the capture has no reference). */
  const sourceMap = new Map<string, LeadGenSource>();
  for (const r of rows) {
    const key = `${r.origin.platform}:${r.origin.kind}:${r.origin.refKind ?? ""}:${r.origin.refId ?? ""}`;
    const cur = sourceMap.get(key) ?? { key, origin: r.origin, leads: 0, hot: 0, won: 0 };
    cur.leads += 1;
    if (r.score === "hot") cur.hot += 1;
    if (r.stage === "won") cur.won += 1;
    sourceMap.set(key, cur);
  }
  const sources = [...sourceMap.values()].sort((a, b) => b.leads - a.leads || b.hot - a.hot);

  /* Comments waiting for a decision (reply_comment_public in ask mode). */
  const comments: Array<LeadGenComment> = leadGenItems
    .filter((w) => w.action === "reply_comment_public" && w.status === "waiting_decision")
    .map((w) => {
      const f = fieldsOf(w);
      const o = originOf(f, text(f.channel_label), "");
      return {
        workItemId: w.id,
        platform: o.platform,
        author: firstText(f, ["author", "author_name", "commenter", "sender_name", "contact_name"]),
        comment: firstText(f, ["comment", "comment_text", "text", "message", "body"]) || w.proposal?.summary || "",
        draft: w.proposal?.draft ?? "",
        refLabel: o.refLabel ?? o.refId,
        at: w.created_at,
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));

  /* Handoffs to Sales and the status of the classify_lead item Sales got. */
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const scoreById = new Map(rows.map((r) => [r.id, r.score]));
  const handoffs: Array<LeadGenHandoff> = [];
  for (const [leadId, h] of handoffItem) {
    const l = leadById.get(leadId);
    if (!l) continue;
    handoffs.push({
      key: h.id, leadId, name: l.contact_name, score: scoreById.get(leadId) ?? null, at: h.completed_at ?? h.created_at,
      classify: classify.get(leadId)?.status ?? null, stage: l.stage, href: `/leads/${leadId}`,
    });
  }
  handoffs.sort((a, b) => b.at.localeCompare(a.at));

  /* Figures. */
  const dayStart = new Date(vnDayStart(nowMs)).toISOString();
  const inWindow = leads.filter((l) => l.created_at >= since);
  const hotWaiting = rows.filter((r) => r.score === "hot" && OPEN_STAGES.includes(r.stage) && classify.get(r.id)?.status !== "done").length;
  const p50 = median(replyDeltas);

  return {
    metrics: {
      newToday: leads.filter((l) => l.created_at >= dayStart).length,
      hotWaiting,
      firstReplyP50Min: p50 === null ? null : Math.round(p50 * 10) / 10,
      firstReplySample: replyDeltas.length,
      conversionWindowDays: CONVERSION_WINDOW_DAYS,
      conversionLeads: inWindow.length,
      conversionWon: inWindow.filter((l) => l.stage === "won").length,
    },
    leads: rows.slice(0, MAX_LEAD_ROWS),
    leadsHidden: Math.max(0, rows.length - MAX_LEAD_ROWS),
    sources,
    comments,
    handoffs,
  };
};
