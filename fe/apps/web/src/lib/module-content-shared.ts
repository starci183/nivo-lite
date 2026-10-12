/**
 * Module "content" (Nội dung mạng xã hội): types and pure helpers shared by the server and the workbench (no I/O, client-safe).
 * The data (holidays, channel rules, pillar presets) lives in resources/content/*.json and is imported at build time.
 */
import calendarJson from "../../resources/content/calendar-vn.json";
import channelsJson from "../../resources/content/channels.json";
import presetsJson from "../../resources/content/pillar-presets.json";

export type ContentChannel = "facebook" | "zalo" | "tiktok" | "instagram";
export const CONTENT_CHANNELS: ReadonlyArray<ContentChannel> = ["facebook", "zalo", "tiktok", "instagram"];
export const isContentChannel = (v: unknown): v is ContentChannel => typeof v === "string" && (CONTENT_CHANNELS as ReadonlyArray<string>).includes(v);

export type ContentStatus = "idea" | "draft" | "waiting_approval" | "approved" | "published" | "skipped";
export const CONTENT_STATUSES: ReadonlyArray<ContentStatus> = ["idea", "draft", "waiting_approval", "approved", "published", "skipped"];
export const isContentStatus = (v: unknown): v is ContentStatus => typeof v === "string" && (CONTENT_STATUSES as ReadonlyArray<string>).includes(v);

export type ChannelRule = { key: ContentChannel; label: string; short: string; max_chars: number; hashtags: { min: number; max: number }; rules: string };
export const CHANNEL_RULES: ReadonlyArray<ChannelRule> = channelsJson.channels as ReadonlyArray<ChannelRule>;
export const GUARDRAILS: ReadonlyArray<string> = channelsJson.guardrails;
export const channelRule = (c: ContentChannel): ChannelRule => CHANNEL_RULES.find((r) => r.key === c) ?? CHANNEL_RULES[0];
export const channelLabel = (c: string): string => CHANNEL_RULES.find((r) => r.key === c)?.label ?? c;

export type PillarPreset = { name: string; description: string; weight: number };
export type CadencePreset = { channel: ContentChannel; posts_per_week: number; days: ReadonlyArray<number>; time: string };
export const PILLAR_PRESETS: ReadonlyArray<PillarPreset> = presetsJson.pillars;
export const CADENCE_PRESETS: ReadonlyArray<CadencePreset> = presetsJson.cadence as ReadonlyArray<CadencePreset>;

export type Pillar = { id: string; workspace_id: string; name: string; description: string; weight: number; sort: number; active: boolean };
export type Cadence = { id: string; workspace_id: string; channel: ContentChannel; posts_per_week: number; days: ReadonlyArray<number>; post_time: string };
export type AutomationKey = "today_reminder" | "offer_draft" | "weekly_summary";
export const AUTOMATION_KEYS: ReadonlyArray<AutomationKey> = ["today_reminder", "offer_draft", "weekly_summary"];
export type ContentSettings = {
  workspace_id: string; brand_voice: string; avoid: string; cta: string; hashtags: ReadonlyArray<string>;
  automations: Record<AutomationKey, boolean>; marks: Record<string, string>;
};
export const DEFAULT_SETTINGS = (workspaceId: string): ContentSettings => ({
  workspace_id: workspaceId, brand_voice: "", avoid: "", cta: "", hashtags: [],
  automations: { today_reminder: false, offer_draft: false, weekly_summary: false }, marks: {},
});

export type Variant = { text: string; hashtags: ReadonlyArray<string>; note: string };
export type Variants = Partial<Record<ContentChannel, Variant>>;
export type MediaRef = { kind: "media" | "video_render"; path?: string; id?: string; name: string; suggested?: boolean };
export type LinkRef = { url: string; label: string };
export type EvidenceLine = { at: string; kind: string; by: string; text: string };
export type PublishedMark = { at: string; by: string; url: string; how: string };

export type ContentItem = {
  id: string; workspace_id: string; plan_id: string | null; title: string; brief: string; pillar_id: string | null;
  channels: ReadonlyArray<ContentChannel>; scheduled_at: string | null; status: ContentStatus; variants: Variants; hashtags: ReadonlyArray<string>;
  media: ReadonlyArray<MediaRef>; links: ReadonlyArray<LinkRef>; holiday_key: string | null; evidence: ReadonlyArray<EvidenceLine>;
  published: Partial<Record<ContentChannel, PublishedMark>>; work_item_id: string | null; drafted_at: string | null;
  approved_by: string | null; approved_at: string | null; published_at: string | null;
  source: "manual" | "plan" | "quick" | "offer" | "automation"; created_by: string; created_at: string; updated_at: string;
};

/* ------------------------------------------------------------------ Vietnam time */

/** Vietnam is UTC+7 all year (no daylight saving), so local <-> UTC is a fixed shift. */
const VN_OFFSET_MS = 7 * 3_600_000;
export const vnParts = (d: Date): { y: number; m: number; day: number; h: number; min: number; dow: number } => {
  const t = new Date(d.getTime() + VN_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, day: t.getUTCDate(), h: t.getUTCHours(), min: t.getUTCMinutes(), dow: t.getUTCDay() };
};
/** ISO instant of a Vietnam wall-clock time. */
export const vnToIso = (y: number, m: number, day: number, h = 0, min = 0): string => new Date(Date.UTC(y, m - 1, day, h, min) - VN_OFFSET_MS).toISOString();
export const pad2 = (n: number): string => String(n).padStart(2, "0");
export const vnDateKey = (d: Date): string => { const p = vnParts(d); return `${p.y}-${pad2(p.m)}-${pad2(p.day)}`; };
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Monday-first weekday 1..7 of a calendar day. */
export const isoWeekday = (y: number, m: number, day: number): number => { const w = new Date(Date.UTC(y, m - 1, day)).getUTCDay(); return w === 0 ? 7 : w; };
/** Monday of the week of a Vietnam date key (yyyy-mm-dd). */
export const weekStartKey = (d: Date): string => {
  const p = vnParts(d);
  const wd = isoWeekday(p.y, p.m, p.day);
  const t = new Date(Date.UTC(p.y, p.m - 1, p.day - (wd - 1)));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
};
export const monthKey = (y: number, m: number): string => `${y}-${pad2(m)}`;
export const parseMonth = (v: string | null | undefined): { y: number; m: number } | null => {
  const r = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  if (!r) return null;
  const y = Number(r[1]); const m = Number(r[2]);
  return m >= 1 && m <= 12 && y >= 2020 && y <= 2100 ? { y, m } : null;
};

/* ------------------------------------------------------------------ holidays */

export type CalendarEvent = {
  key: string; name: string; kind: "holiday" | "observance" | "sale_day"; lead_days: number; angle: string;
  fixed?: { month: number; day: number }; nth?: { month: number; weekday: number; n: number }; dates?: Record<string, string>; span_days?: number;
};
export const CALENDAR_EVENTS: ReadonlyArray<CalendarEvent> = calendarJson.events as ReadonlyArray<CalendarEvent>;

export type DatedEvent = { key: string; name: string; kind: CalendarEvent["kind"]; date: string; lead_days: number; angle: string };

/** Day (1..31) of the n-th given weekday (0 = Sunday) of a month. */
const nthWeekday = (y: number, m: number, weekday: number, n: number): number => {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
};

/** The date (yyyy-mm-dd) of an event in a year, or null (a lunar event whose date is not in the list). */
export const eventDate = (e: CalendarEvent, year: number): string | null => {
  if (e.fixed) return `${year}-${pad2(e.fixed.month)}-${pad2(e.fixed.day)}`;
  if (e.nth) return `${year}-${pad2(e.nth.month)}-${pad2(nthWeekday(year, e.nth.month, e.nth.weekday, e.nth.n))}`;
  return e.dates?.[String(year)] ?? null;
};

/**
 * Holidays and observances that matter to a month: events whose date falls inside the month, plus events within `lead_days` after the month
 * ends whose preparation posts belong to this month.
 */
export const eventsForMonth = (y: number, m: number): Array<DatedEvent> => {
  const start = Date.UTC(y, m - 1, 1);
  const end = Date.UTC(y, m, 0);
  const out: Array<DatedEvent> = [];
  for (const e of CALENDAR_EVENTS) {
    for (const year of [y, y + 1]) {
      const date = eventDate(e, year);
      if (!date) continue;
      const t = Date.parse(`${date}T00:00:00Z`);
      const inMonth = t >= start && t <= end;
      const prep = t > end && t - end <= Math.min(e.lead_days, 14) * 86_400_000;
      if (inMonth || prep) out.push({ key: e.key, name: e.name, kind: e.kind, date, lead_days: e.lead_days, angle: e.angle });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
};

/* ------------------------------------------------------------------ cadence slots */

export type Slot = { channel: ContentChannel; at: string };

/** The posting slots a cadence implies for a month (ISO instants, Vietnam time), skipping days before `from`. `days` empty = spread evenly. */
export const slotsForMonth = (y: number, m: number, cadence: ReadonlyArray<Pick<Cadence, "channel" | "posts_per_week" | "days" | "post_time">>, from: Date = new Date(0)): Array<Slot> => {
  const slots: Array<Slot> = [];
  const dim = daysInMonth(y, m);
  for (const c of cadence) {
    if (c.posts_per_week <= 0) continue;
    const [hh, mm] = c.post_time.split(":").map(Number);
    const days = c.days.length ? [...c.days] : defaultDays(c.posts_per_week);
    for (let day = 1; day <= dim; day++) {
      if (!days.includes(isoWeekday(y, m, day))) continue;
      const at = vnToIso(y, m, day, hh, mm);
      if (Date.parse(at) < from.getTime()) continue;
      slots.push({ channel: c.channel, at });
    }
  }
  return slots.sort((a, b) => a.at.localeCompare(b.at));
};

const defaultDays = (perWeek: number): Array<number> => {
  const table: Record<number, Array<number>> = { 1: [3], 2: [2, 5], 3: [2, 4, 6], 4: [1, 3, 5, 6], 5: [1, 2, 4, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] };
  return table[Math.min(7, Math.max(1, perWeek))] ?? [2, 4, 6];
};

/* ------------------------------------------------------------------ pillar balance */

export type BalanceRow = { pillarId: string | null; name: string; weight: number; count: number; targetShare: number; actualShare: number };

/** Planned posts per pillar against the share each pillar's weight asks for. Skipped posts do not count. */
export const pillarBalance = (pillars: ReadonlyArray<Pillar>, items: ReadonlyArray<Pick<ContentItem, "pillar_id" | "status">>): Array<BalanceRow> => {
  const live = items.filter((i) => i.status !== "skipped");
  const active = pillars.filter((p) => p.active);
  const totalWeight = active.reduce((s, p) => s + p.weight, 0) || 1;
  const rows: Array<BalanceRow> = active.map((p) => {
    const count = live.filter((i) => i.pillar_id === p.id).length;
    return { pillarId: p.id, name: p.name, weight: p.weight, count, targetShare: p.weight / totalWeight, actualShare: live.length ? count / live.length : 0 };
  });
  const none = live.filter((i) => !i.pillar_id || !active.some((p) => p.id === i.pillar_id)).length;
  if (none > 0) rows.push({ pillarId: null, name: "", weight: 0, count: none, targetShare: 0, actualShare: live.length ? none / live.length : 0 });
  return rows;
};

/* ------------------------------------------------------------------ small helpers */

export const cleanHashtag = (h: string): string => {
  const w = h.trim().replace(/^#+/, "").replace(/[\s#]+/g, "");
  return w ? `#${w}` : "";
};
export const cleanHashtags = (list: ReadonlyArray<string>): Array<string> => [...new Set(list.map(cleanHashtag).filter(Boolean))];

/** The text of one channel exactly as it will be pasted: body, then the hashtags that are not already in it. */
export const copyText = (v: Variant | undefined): string => {
  if (!v) return "";
  const missing = v.hashtags.filter((h) => !v.text.includes(h));
  return missing.length ? `${v.text.trimEnd()}\n\n${missing.join(" ")}` : v.text;
};

export const emptyVariant = (): Variant => ({ text: "", hashtags: [], note: "" });
