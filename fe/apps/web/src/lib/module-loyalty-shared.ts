/**
 * Loyalty ("Khách hàng thân thiết"): types and PURE helpers (no I/O, safe in client components).
 * The numbers and wording of the programme are data (resources/loyalty/*.json, then the workspace's own `loyalty_programs.config`); this file only
 * reads them. Phones are normalised like src/lib/core.ts normaliseContact (84xxxxxxxxx), so "0912 345 678", "+84 912 345 678" and "84912345678" are one customer.
 */
import defaults from "../../resources/loyalty/defaults.json";
import presets from "../../resources/loyalty/reward-presets.json";
import messages from "../../resources/loyalty/messages.json";

export type LoyaltyTier = { key: string; name: string; minSpendVnd: number; multiplier: number; winbackDays: number; benefit: string };
export type LoyaltyCategoryRule = { match: string; perThousandVnd: number; label: string };
export type LoyaltyConfig = {
  earn: { perThousandVnd: number; perVisit: number; categories: Array<LoyaltyCategoryRule>; trigger: "payment" | "order"; minOrderVnd: number };
  tiers: Array<LoyaltyTier>;
  expiry: { months: number; warnDays: number };
  birthday: { enabled: boolean; points: number; rewardKey: string; note: string };
  promo: { maxPerMonth: number; hourFrom: string; hourTo: string; batch: number };
};

export type RewardKind = "voucher" | "item" | "percent";
export type Reward = {
  id: string; key: string; name: string; kind: RewardKind; valueVnd: number; percent: number | null; pointsCost: number;
  stock: number | null; perCustomerLimit: number | null; minTierKey: string | null; note: string; active: boolean; sortOrder: number;
};
export type RewardInput = Omit<Reward, "id" | "sortOrder" | "active"> & { active?: boolean };

export type LedgerKind = "earn" | "redeem" | "expire" | "adjust";
export type LedgerRow = {
  id: string; customerId: string; kind: LedgerKind; points: number; amountVnd: number | null; orderId: string | null; ref: string; by: string;
  evidence: string | null; rewardId: string | null; workItemId: string | null; expiresAt: string | null; occurredAt: string;
};

export type Member = {
  id: string; name: string; phone: string | null; email: string | null; birthday: string | null; tierKey: string | null;
  points: number; lifetimeSpendVnd: number; visits: number; lastVisitAt: string | null; joinedAt: string; note: string;
};

export type Segment = {
  /** Customers holding one of these tiers (empty or missing = any). */
  tiers?: ReadonlyArray<string>;
  /** Last visit at least N days ago (customers who never bought count as inactive since they joined). */
  inactiveDays?: number;
  /** Birthday falls in the current month (Vietnam time). */
  birthdayThisMonth?: boolean;
  /** Lifetime spend of at least this many VND. */
  minSpendVnd?: number;
};

export const DEFAULT_CONFIG: LoyaltyConfig = defaults as LoyaltyConfig;
export const REWARD_PRESETS: ReadonlyArray<RewardInput> = presets as Array<RewardInput>;
export const MESSAGE_TEMPLATES: Readonly<Record<"birthday" | "tier_up" | "expiring" | "winback" | "promo" | "otp", string>> = messages;

/* ------------------------------------------------------------------ phone and contact */

/** VN phone -> `84xxxxxxxxx`; null when it is not a plausible phone (7 to 12 digits after the country code is not enough, so it must be 84 + 9 or 10 digits). */
export const normalisePhone = (raw: string | null | undefined): string | null => {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `84${d.slice(1)}`;
  else if (!d.startsWith("84") && (d.length === 9 || d.length === 10)) d = `84${d}`;
  return /^84\d{9,10}$/.test(d) ? d : null;
};

export const normaliseEmail = (raw: string | null | undefined): string | null => {
  const v = String(raw ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : null;
};

/** `84912345678` -> `0912 345 678` for screens. */
export const displayPhone = (phone: string | null): string => {
  if (!phone) return "";
  const local = phone.startsWith("84") ? `0${phone.slice(2)}` : phone;
  return local.length === 10 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : local;
};

/** `84912345678` -> `0912 *** 678` (the public page never shows a whole phone number). */
export const maskPhone = (phone: string | null): string => {
  const local = phone ? (phone.startsWith("84") ? `0${phone.slice(2)}` : phone) : "";
  return local.length >= 8 ? `${local.slice(0, 4)} *** ${local.slice(-3)}` : "";
};

const stripAccents = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();

/* ------------------------------------------------------------------ config */

const num = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const text = (v: unknown, fallback: string, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : fallback);
const hhmm = (v: unknown, fallback: string): string => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
const slug = (v: string): string => stripAccents(v).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "hang";

/** A stored (or submitted) config over the defaults: every number clamped, tiers sorted by threshold, the first tier always starting at 0. Never throws. */
export const resolveConfig = (saved: unknown): LoyaltyConfig => {
  const s = (saved && typeof saved === "object" ? saved : {}) as Record<string, Record<string, unknown> | Array<Record<string, unknown>> | undefined>;
  const d = DEFAULT_CONFIG;
  const earn = (s.earn && !Array.isArray(s.earn) ? s.earn : {}) as Record<string, unknown>;
  const cats = Array.isArray(earn.categories) ? (earn.categories as Array<Record<string, unknown>>) : d.earn.categories;
  const rawTiers = Array.isArray(s.tiers) && s.tiers.length ? (s.tiers as Array<Record<string, unknown>>) : d.tiers;
  const seen = new Set<string>();
  const tiers = rawTiers.slice(0, 8).map((t, i): LoyaltyTier => {
    const name = text(t.name, `Hạng ${i + 1}`, 30) || `Hạng ${i + 1}`;
    let key = text(t.key, "", 24) || slug(name);
    while (seen.has(key)) key = `${key}-${i}`;
    seen.add(key);
    return {
      key, name, minSpendVnd: Math.round(num(t.minSpendVnd, 0, 0, 1e12)), multiplier: Math.round(num(t.multiplier, 1, 1, 10) * 100) / 100,
      winbackDays: Math.round(num(t.winbackDays, 45, 7, 365)), benefit: text(t.benefit, "", 200),
    };
  }).sort((a, b) => a.minSpendVnd - b.minSpendVnd);
  if (tiers.length) tiers[0] = { ...tiers[0], minSpendVnd: 0 };
  const exp = (s.expiry && !Array.isArray(s.expiry) ? s.expiry : {}) as Record<string, unknown>;
  const bd = (s.birthday && !Array.isArray(s.birthday) ? s.birthday : {}) as Record<string, unknown>;
  const pr = (s.promo && !Array.isArray(s.promo) ? s.promo : {}) as Record<string, unknown>;
  return {
    earn: {
      perThousandVnd: Math.round(num(earn.perThousandVnd, d.earn.perThousandVnd, 0, 1000) * 100) / 100,
      perVisit: Math.round(num(earn.perVisit, d.earn.perVisit, 0, 100000)),
      categories: cats.slice(0, 12).map((c) => ({ match: text(c.match, "", 40), perThousandVnd: Math.round(num(c.perThousandVnd, 1, 0, 1000) * 100) / 100, label: text(c.label, "", 40) })).filter((c) => c.match),
      trigger: earn.trigger === "order" ? "order" : "payment",
      minOrderVnd: Math.round(num(earn.minOrderVnd, d.earn.minOrderVnd, 0, 1e12)),
    },
    tiers,
    expiry: { months: Math.round(num(exp.months, d.expiry.months, 0, 120)), warnDays: Math.round(num(exp.warnDays, d.expiry.warnDays, 1, 180)) },
    birthday: {
      enabled: bd.enabled === undefined ? d.birthday.enabled : bd.enabled === true || bd.enabled === "true",
      points: Math.round(num(bd.points, d.birthday.points, 0, 1e6)), rewardKey: text(bd.rewardKey, d.birthday.rewardKey, 40), note: text(bd.note, d.birthday.note, 200),
    },
    promo: {
      maxPerMonth: Math.round(num(pr.maxPerMonth, d.promo.maxPerMonth, 1, 60)), hourFrom: hhmm(pr.hourFrom, d.promo.hourFrom), hourTo: hhmm(pr.hourTo, d.promo.hourTo),
      batch: Math.round(num(pr.batch, d.promo.batch, 1, 200)),
    },
  };
};

/* ------------------------------------------------------------------ tiers and points */

/** The tier a lifetime spend reaches (the highest threshold not above it). Null when the programme has no tiers. */
export const tierFor = (config: LoyaltyConfig, lifetimeSpendVnd: number): LoyaltyTier | null => {
  let found: LoyaltyTier | null = null;
  for (const t of config.tiers) if (lifetimeSpendVnd >= t.minSpendVnd) found = t;
  return found;
};

export const tierOf = (config: LoyaltyConfig, key: string | null): LoyaltyTier | null => config.tiers.find((t) => t.key === key) ?? null;
export const tierRank = (config: LoyaltyConfig, key: string | null): number => config.tiers.findIndex((t) => t.key === key);
/** The next tier above the one held, with the spend still missing. */
export const nextTier = (config: LoyaltyConfig, lifetimeSpendVnd: number): { tier: LoyaltyTier; missingVnd: number } | null => {
  const next = config.tiers.find((t) => t.minSpendVnd > lifetimeSpendVnd);
  return next ? { tier: next, missingVnd: next.minSpendVnd - lifetimeSpendVnd } : null;
};

/**
 * Points for one purchase. The rate is the best matching category rule (the order's items text contains the rule's word, accents and case ignored) or the
 * general rate; the tier's multiplier applies to the spend points; the per-visit points are added after. Rounded down. Below the minimum order: 0.
 */
export const pointsFor = (config: LoyaltyConfig, p: { amountVnd: number; items?: string | null; tier?: LoyaltyTier | null }): { points: number; rate: number; note: string } => {
  const amount = Math.max(0, Math.round(p.amountVnd));
  if (amount <= 0 || amount < config.earn.minOrderVnd) return { points: 0, rate: 0, note: "Đơn dưới mức tối thiểu để tích điểm." };
  const items = stripAccents(p.items ?? "");
  let rate = config.earn.perThousandVnd;
  let label = "";
  for (const c of config.earn.categories) {
    if (stripAccents(c.match) && items.includes(stripAccents(c.match)) && c.perThousandVnd > rate) {
      rate = c.perThousandVnd;
      label = c.label || c.match;
    }
  }
  const mult = p.tier?.multiplier ?? 1;
  const points = Math.floor((amount / 1000) * rate * mult) + config.earn.perVisit;
  const parts = [`${rate} điểm mỗi 1.000 ₫${label ? ` (nhóm "${label}")` : ""}`, mult > 1 ? `hạng ${p.tier?.name} nhân ${mult}` : "", config.earn.perVisit ? `+${config.earn.perVisit} điểm mỗi lượt` : ""].filter(Boolean);
  return { points, rate, note: parts.join(", ") };
};

/** Points that have passed their expiry date and are still unspent. Redeems consume the OLDEST earned points first, so: expired = earned-and-due minus everything already spent or expired. */
export const expirablePoints = (rows: ReadonlyArray<Pick<LedgerRow, "kind" | "points" | "expiresAt">>, now: Date): number => {
  let due = 0;
  let spent = 0;
  for (const r of rows) {
    if (r.kind === "earn" && r.expiresAt && Date.parse(r.expiresAt) <= now.getTime()) due += r.points;
    else if (r.kind === "redeem" || r.kind === "expire") spent += -r.points;
  }
  const balance = rows.reduce((n, r) => n + r.points, 0);
  return Math.max(0, Math.min(due - spent, balance));
};

/** Earned points that expire within `days` and are still unspent (for the warning), with the date of the first batch. */
export const expiringSoon = (rows: ReadonlyArray<Pick<LedgerRow, "kind" | "points" | "expiresAt">>, now: Date, days: number): { points: number; firstAt: string | null } => {
  const horizon = new Date(now.getTime() + days * 86_400_000);
  const dueNow = expirablePoints(rows, now);
  const dueSoon = expirablePoints(rows, horizon);
  const first = rows.filter((r) => r.kind === "earn" && r.expiresAt && Date.parse(r.expiresAt) > now.getTime() && Date.parse(r.expiresAt) <= horizon.getTime()).map((r) => r.expiresAt as string).sort()[0] ?? null;
  return { points: Math.max(0, dueSoon - dueNow), firstAt: first };
};

/* ------------------------------------------------------------------ rewards */

export const rewardLine = (r: Pick<Reward, "name" | "pointsCost">): string => `${r.name} (${r.pointsCost.toLocaleString("vi-VN")} điểm)`;

/** Why a customer cannot redeem a reward right now, or null when they can. */
export const redeemBlock = (
  config: LoyaltyConfig, r: Reward, c: { points: number; tierKey: string | null; redeemedBefore: number },
): string | null => {
  if (!r.active) return "Quà này tạm ngưng đổi.";
  if (r.stock !== null && r.stock <= 0) return "Quà này đã hết.";
  if (c.points < r.pointsCost) return `Chưa đủ điểm: cần ${r.pointsCost.toLocaleString("vi-VN")}, bạn có ${c.points.toLocaleString("vi-VN")}.`;
  if (r.perCustomerLimit !== null && c.redeemedBefore >= r.perCustomerLimit) return `Mỗi khách đổi tối đa ${r.perCustomerLimit} lần quà này.`;
  if (r.minTierKey && tierRank(config, c.tierKey) < tierRank(config, r.minTierKey)) return `Quà này dành cho hạng ${tierOf(config, r.minTierKey)?.name ?? r.minTierKey} trở lên.`;
  return null;
};

/* ------------------------------------------------------------------ segments */

export const SEGMENT_DEFAULT: Segment = {};

export const segmentLabel = (config: LoyaltyConfig, s: Segment): string => {
  const parts: Array<string> = [];
  if (s.tiers?.length) parts.push(`hạng ${s.tiers.map((k) => tierOf(config, k)?.name ?? k).join(" hoặc ")}`);
  if (s.inactiveDays) parts.push(`lâu không quay lại (từ ${s.inactiveDays} ngày)`);
  if (s.birthdayThisMonth) parts.push("sinh nhật trong tháng này");
  if (s.minSpendVnd) parts.push(`đã chi từ ${s.minSpendVnd.toLocaleString("vi-VN")} ₫`);
  return parts.length ? parts.join(", ") : "tất cả khách thân thiết";
};

export const resolveSegment = (raw: unknown): Segment => {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Segment = {};
  if (Array.isArray(s.tiers)) out.tiers = s.tiers.filter((x): x is string => typeof x === "string").slice(0, 8);
  const days = num(s.inactiveDays, 0, 0, 3650);
  if (days > 0) out.inactiveDays = Math.round(days);
  if (s.birthdayThisMonth === true) out.birthdayThisMonth = true;
  const spend = num(s.minSpendVnd, 0, 0, 1e12);
  if (spend > 0) out.minSpendVnd = Math.round(spend);
  return out;
};

/** Does a member match a segment? `nowIso` decides "this month" in Vietnam time. */
export const inSegment = (m: Member, s: Segment, nowIso: string): boolean => {
  if (s.tiers?.length && !s.tiers.includes(m.tierKey ?? "")) return false;
  if (s.minSpendVnd && m.lifetimeSpendVnd < s.minSpendVnd) return false;
  if (s.inactiveDays) {
    const last = Date.parse(m.lastVisitAt ?? m.joinedAt);
    if (Date.parse(nowIso) - last < s.inactiveDays * 86_400_000) return false;
  }
  if (s.birthdayThisMonth) {
    if (!m.birthday) return false;
    const month = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", month: "numeric" }).format(new Date(nowIso)));
    if (Number(m.birthday.slice(5, 7)) !== month) return false;
  }
  return true;
};

/** Fill {ten_khach} {ten_shop} {diem} {hang} {uu_dai} {han} {ma}; an unknown or empty value reads as a neutral word, never as a raw placeholder. */
export const fillLoyaltyBody = (body: string, v: Readonly<Record<string, string | undefined>>): string =>
  body.replace(/\{([a-z_]+)\}/g, (_, k: string) => (v[k] ?? "").trim() || ({ ten_khach: "bạn", ten_shop: "cửa hàng", uu_dai: "ưu đãi riêng" } as Record<string, string>)[k] || "")
    .replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,!?])/g, "$1").trim();

export const formatPoints = (n: number): string => `${n.toLocaleString("vi-VN")} điểm`;
export const formatVndShort = (n: number): string => `${Math.round(n).toLocaleString("vi-VN")} ₫`;

/* ------------------------------------------------------------------ the chat contract */

/**
 * What the customer-facing model is told about loyalty (appended to the chatbot's per-turn context when the module is installed, and the loyalty agent's own
 * reply contract in engine-sync REPLY_CONTRACTS). The numbers come from the [LOYALTY PROGRAMME] block NIVO builds from the ledger; the model never computes points.
 */
export const LOYALTY_REPLY_CONTRACT = `LOYALTY: add to your final JSON object the field "loyalty": null | {"intent": "redeem", "reward_key": string}.
Answer questions about points, tier, expiry and which rewards the customer can redeem ONLY from the [LOYALTY PROGRAMME] block (Vietnamese, exact numbers, never estimate or round).
When the customer clearly asks to redeem ONE reward, set "loyalty" to {"intent": "redeem", "reward_key": <the key of that reward in the catalogue>} and in "reply" say you are handling the request; never say it is done, never promise a reward that is not in the catalogue.
If THIS CUSTOMER is not recognised, ask for the phone number they used when buying instead of guessing a balance. Otherwise "loyalty": null.`;
