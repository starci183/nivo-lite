/**
 * Meta (Facebook Pages + Instagram professional accounts): the pure part. No "server-only", no local runtime imports, no network:
 * constants, the Graph URL builder, the webhook signature check, the webhook payload parser (normalised events), the lead-field parser,
 * the messaging-window and private-reply rules, the text chunker, and the per-Page rate limiter. meta.ts (calls) and meta-inbound.ts
 * (storing and dispatching) build on it; the checks of this file can be run with plain node.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/* ------------------------------------------------------------------ configuration */

/** The permissions asked at login (Facebook Login for Business, or the classic dialog when no configuration id is set). */
export const META_SCOPES: ReadonlyArray<string> = [
  "pages_show_list", "pages_manage_metadata", "pages_messaging", "pages_read_engagement", "pages_manage_engagement",
  "leads_retrieval", "instagram_basic", "instagram_manage_messages", "instagram_manage_comments", "business_management",
];

/** Page webhook fields the Page is subscribed to (POST /{page-id}/subscribed_apps). */
export const PAGE_FIELDS: ReadonlyArray<string> = ["messages", "messaging_postbacks", "feed", "leadgen"];
/** Instagram webhook fields (app-level subscription of the `instagram` object; `messages` also needs the Page subscribed). */
export const INSTAGRAM_FIELDS: ReadonlyArray<string> = ["messages", "comments", "mentions"];

export const MIN_GRAPH_VERSION = 21;
export const DEFAULT_GRAPH_VERSION = "v21.0";

type Env = Readonly<Record<string, string | undefined>>;

/** META_GRAPH_VERSION ("v21.0" or later); anything older or malformed falls back to v21.0. */
export const graphVersion = (env: Env = process.env): string => {
  const m = /^v(\d{2,3})\.(\d{1,2})$/.exec((env.META_GRAPH_VERSION ?? "").trim());
  return m && Number(m[1]) >= MIN_GRAPH_VERSION ? `v${m[1]}.${m[2]}` : DEFAULT_GRAPH_VERSION;
};

export const graphUrl = (path: string, params: Readonly<Record<string, string | number | boolean | undefined>> = {}, env: Env = process.env): string => {
  const url = new URL(`https://graph.facebook.com/${graphVersion(env)}/${path.replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  return url.toString();
};

export const dialogUrl = (params: Readonly<Record<string, string | undefined>>, env: Env = process.env): string => {
  const url = new URL(`https://www.facebook.com/${graphVersion(env)}/dialog/oauth`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  return url.toString();
};

const trim = (s: string): string => s.replace(/\/+$/, "");
export const siteBase = (env: Env = process.env): string => trim(env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100");
/** The OAuth redirect URI to register on the Meta app (Facebook Login > Settings > Valid OAuth Redirect URIs). */
export const redirectUri = (env: Env = process.env): string => `${siteBase(env)}/api/connections/meta/callback`;
/** The one webhook URL of the Meta app (Webhooks > Callback URL). */
export const webhookUrl = (env: Env = process.env): string => `${siteBase(env)}/api/connections/meta/webhook`;

export type MetaApp = { readonly appId: string; readonly appSecret: string };
export const metaApp = (env: Env = process.env): MetaApp | null => {
  const appId = (env.META_APP_ID ?? "").trim();
  const appSecret = (env.META_APP_SECRET ?? "").trim();
  return appId && appSecret ? { appId, appSecret } : null;
};

/** The state-signing key for the Meta OAuth round trip: derived from the channel key (never the key itself), distinct from Google's. */
export const metaStateKey = (channelKeyBase64: string | undefined): Buffer => {
  const raw = channelKeyBase64 ? Buffer.from(channelKeyBase64, "base64") : Buffer.alloc(0);
  if (raw.length !== 32) throw new Error("CHANNEL_TOKEN_KEY must be 32 bytes, base64");
  return createHmac("sha256", raw).update("nivo:meta-oauth-state:v1").digest();
};
export const META_STATE_PURPOSE = "meta";

/* ------------------------------------------------------------------ webhook authentication */

/** Constant-time equality of two strings (different lengths are simply unequal). */
export const safeEq = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** `X-Hub-Signature-256: sha256=<hex>` is HMAC-SHA256 of the RAW request body with the app secret. Constant-time compare. */
export const verifySignature = (header: string | null | undefined, rawBody: Buffer | string, appSecret: string): boolean => {
  if (!header || !appSecret) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(m[1], "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
};

/** GET verification: hub.mode=subscribe and hub.verify_token equal to META_WEBHOOK_VERIFY_TOKEN gives back hub.challenge, else null. */
export const verifyChallenge = (query: { get(name: string): string | null }, verifyToken: string | undefined): string | null => {
  const token = (verifyToken ?? "").trim();
  const challenge = query.get("hub.challenge");
  if (!token || challenge === null || query.get("hub.mode") !== "subscribe") return null;
  return safeEq(query.get("hub.verify_token") ?? "", token) ? challenge : null;
};

/* ------------------------------------------------------------------ normalised events */

export type MetaPlatform = "facebook" | "instagram";
export type MetaEventKind = "dm" | "comment" | "leadgen" | "mention" | "postback";
export type MetaReferral = { readonly ref: string | null; readonly source: string | null; readonly type: string | null; readonly ad_id: string | null };

export type MetaEvent = {
  readonly kind: MetaEventKind;
  readonly platform: MetaPlatform;
  /** The Page the event belongs to (Facebook events; null on Instagram events, where only the Instagram account id is in the payload). */
  readonly page_id: string | null;
  readonly ig_id: string | null;
  /** Page-scoped id of the person (Facebook) / Instagram-scoped id (Instagram). */
  readonly sender_psid: string | null;
  readonly sender_igsid: string | null;
  readonly sender_name: string | null;
  readonly text: string | null;
  readonly comment_id: string | null;
  readonly post_id: string | null;
  readonly leadgen_id: string | null;
  readonly form_id: string | null;
  readonly ad_id: string | null;
  readonly referral: MetaReferral | null;
  readonly postback_payload: string | null;
  readonly mid: string | null;
  /** Milliseconds since the epoch. */
  readonly timestamp: number;
  /** Stable per event: the idempotency key (Meta redelivers). */
  readonly event_key: string;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const arr = (v: unknown): Array<unknown> => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
/** Meta sends seconds in `time`/`created_time` and milliseconds in messaging `timestamp`. */
const ms = (v: number | null, unit: "s" | "ms"): number | null => (v === null ? null : unit === "s" ? v * 1000 : v);

const referralOf = (v: unknown): MetaReferral | null => {
  const r = obj(v);
  if (!r) return null;
  const ads = obj(r.ads_context_data);
  const out: MetaReferral = { ref: str(r.ref), source: str(r.source), type: str(r.type), ad_id: str(r.ad_id) ?? str(ads?.ad_id) };
  return out.ref || out.source || out.type || out.ad_id ? out : null;
};

const blank = (platform: MetaPlatform, kind: MetaEventKind, timestamp: number, event_key: string): MetaEvent => ({
  kind, platform, page_id: null, ig_id: null, sender_psid: null, sender_igsid: null, sender_name: null, text: null, comment_id: null, post_id: null,
  leadgen_id: null, form_id: null, ad_id: null, referral: null, postback_payload: null, mid: null, timestamp, event_key,
});

const idsFor = (platform: MetaPlatform, entryId: string | null): { page_id: string | null; ig_id: string | null } =>
  platform === "facebook" ? { page_id: entryId, ig_id: null } : { page_id: null, ig_id: entryId };

const senderFor = (platform: MetaPlatform, id: string | null): { sender_psid: string | null; sender_igsid: string | null } =>
  platform === "facebook" ? { sender_psid: id, sender_igsid: null } : { sender_psid: null, sender_igsid: id };

/** One `messaging` item (also the value of a `messages` / `messaging_postbacks` change): a DM or a postback, never an echo, receipt or reaction. */
const fromMessaging = (platform: MetaPlatform, entryId: string | null, item: unknown, fallbackTime: number): MetaEvent | null => {
  const m = obj(item);
  if (!m) return null;
  const senderId = str(obj(m.sender)?.id);
  if (!senderId || senderId === entryId) return null;
  const when = ms(num(m.timestamp), "ms") ?? fallbackTime;
  const message = obj(m.message);
  const postback = obj(m.postback);
  if (message?.is_echo === true) return null;
  if (postback) {
    const mid = str(postback.mid);
    const payload = str(postback.payload);
    const title = str(postback.title);
    return {
      ...blank(platform, "postback", when, `postback:${mid ?? `${senderId}:${when}:${payload ?? title ?? ""}`}`),
      ...idsFor(platform, entryId), ...senderFor(platform, senderId),
      text: title ?? payload, postback_payload: payload, mid, referral: referralOf(postback.referral) ?? referralOf(m.referral),
    };
  }
  if (message) {
    const mid = str(message.mid);
    const quick = str(obj(message.quick_reply)?.payload);
    const hasAttachment = arr(message.attachments).length > 0;
    const text = str(message.text);
    if (!text && !hasAttachment && !quick) return null;
    return {
      ...blank(platform, "dm", when, `dm:${mid ?? `${senderId}:${when}`}`),
      ...idsFor(platform, entryId), ...senderFor(platform, senderId),
      text: text ?? quick, mid, postback_payload: quick, referral: referralOf(message.referral) ?? referralOf(m.referral),
    };
  }
  return null; // delivery, read, reaction ... receipts
};

const fromFacebookChange = (entryId: string | null, change: Obj, time: number): MetaEvent | null => {
  const field = str(change.field);
  const v = obj(change.value);
  if (!field || !v) return null;
  if (field === "messages" || field === "messaging_postbacks") return fromMessaging("facebook", entryId, v, time);
  if (field === "leadgen") {
    const leadgenId = str(v.leadgen_id);
    if (!leadgenId) return null;
    return {
      ...blank("facebook", "leadgen", ms(num(v.created_time), "s") ?? time, `leadgen:${leadgenId}`),
      page_id: str(v.page_id) ?? entryId, leadgen_id: leadgenId, form_id: str(v.form_id), ad_id: str(v.ad_id),
    };
  }
  if (field === "feed" || field === "mention") {
    const item = str(v.item);
    const verb = str(v.verb);
    const from = obj(v.from);
    const fromId = str(from?.id);
    if (fromId && fromId === entryId) return null; // the Page's own comment
    if (field === "feed" && !(item === "comment" && verb === "add")) return null;
    if (field === "mention" && verb !== null && verb !== "add") return null;
    const commentId = str(v.comment_id);
    const postId = str(v.post_id);
    const key = field === "mention" ? `mention:${commentId ?? postId ?? ""}` : `comment:${commentId ?? ""}`;
    if (key.endsWith(":")) return null;
    return {
      ...blank("facebook", field === "mention" ? "mention" : "comment", ms(num(v.created_time), "s") ?? time, key),
      page_id: entryId, ...senderFor("facebook", fromId), sender_name: str(from?.name), text: str(v.message), comment_id: commentId, post_id: postId,
    };
  }
  return null;
};

const fromInstagramChange = (entryId: string | null, change: Obj, time: number): MetaEvent | null => {
  const field = str(change.field);
  const v = obj(change.value);
  if (!field || !v) return null;
  if (field === "messages" || field === "messaging_postbacks") return fromMessaging("instagram", entryId, v, time);
  if (field === "comments") {
    const commentId = str(v.id);
    const from = obj(v.from);
    const fromId = str(from?.id);
    if (!commentId || (fromId && fromId === entryId)) return null;
    return {
      ...blank("instagram", "comment", time, `comment:${commentId}`),
      ig_id: entryId, ...senderFor("instagram", fromId), sender_name: str(from?.username), text: str(v.text), comment_id: commentId, post_id: str(obj(v.media)?.id),
    };
  }
  if (field === "mentions") {
    const commentId = str(v.comment_id);
    const mediaId = str(v.media_id);
    if (!commentId && !mediaId) return null;
    return { ...blank("instagram", "mention", time, `mention:${commentId ?? mediaId}`), ig_id: entryId, comment_id: commentId, post_id: mediaId };
  }
  return null;
};

/**
 * A webhook body -> normalised events. object "page" is Facebook, object "instagram" is Instagram; anything else (or garbage) gives [].
 * Echoes of our own sends, delivery/read receipts, reactions and our own comments are dropped.
 */
export const parseWebhook = (body: unknown): Array<MetaEvent> => {
  const root = obj(body);
  const object = root ? str(root.object) : null;
  const platform: MetaPlatform | null = object === "page" ? "facebook" : object === "instagram" ? "instagram" : null;
  if (!root || !platform) return [];
  const out: Array<MetaEvent> = [];
  for (const raw of arr(root.entry)) {
    const entry = obj(raw);
    if (!entry) continue;
    const entryId = str(entry.id);
    const time = ms(num(entry.time), "s") ?? Date.now();
    for (const item of arr(entry.messaging)) {
      const ev = fromMessaging(platform, entryId, item, time);
      if (ev) out.push(ev);
    }
    for (const raw2 of arr(entry.changes)) {
      const change = obj(raw2);
      if (!change) continue;
      const ev = platform === "facebook" ? fromFacebookChange(entryId, change, time) : fromInstagramChange(entryId, change, time);
      if (ev) out.push(ev);
    }
  }
  return out;
};

/* ------------------------------------------------------------------ lead ads */

export type MetaLead = {
  readonly name: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  /** Every answer, by the form question's key. */
  readonly fields: Readonly<Record<string, string>>;
  readonly ad_id: string | null;
  readonly form_id: string | null;
  readonly created_at: string | null;
};

/** GET /{leadgen_id} -> the contact and every answer. Phone numbers keep their digits and a leading plus. */
export const parseLead = (data: unknown): MetaLead => {
  const d = obj(data) ?? {};
  const fields: Record<string, string> = {};
  for (const raw of arr(d.field_data)) {
    const f = obj(raw);
    const name = str(f?.name);
    const value = arr(f?.values).map(str).filter((x): x is string => x !== null).join(", ");
    if (name && value) fields[name] = value;
  }
  const pick = (...keys: Array<string>): string | null => {
    for (const k of keys) if (fields[k]) return fields[k];
    return null;
  };
  const first = pick("first_name");
  const last = pick("last_name");
  const name = pick("full_name", "name") ?? ([first, last].filter(Boolean).join(" ") || null);
  const phoneRaw = pick("phone_number", "phone");
  const phone = phoneRaw ? phoneRaw.replace(/[^\d+]/g, "") || null : null;
  return { name, phone, email: pick("email"), fields, ad_id: str(d.ad_id), form_id: str(d.form_id), created_at: str(d.created_time) };
};

/* ------------------------------------------------------------------ platform rules */

export const HOUR_MS = 3_600_000;
/** Standard messaging: a Page may answer within 24 hours of the person's last message. */
export const STANDARD_WINDOW_MS = 24 * HOUR_MS;
/** The HUMAN_AGENT tag extends that to 7 days, for a real person's reply only. */
export const HUMAN_AGENT_WINDOW_MS = 7 * 24 * HOUR_MS;
/** A private reply to a comment must be sent within 7 days of the comment, once per comment. */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * HOUR_MS;

export type MessageTag = "HUMAN_AGENT";
export type WindowVerdict =
  | { readonly ok: true; readonly via: "standard" | "human_agent" }
  | { readonly ok: false; readonly reason: "no_user_message" | "window_expired" | "human_agent_expired" };

/**
 * May the Page message this person now? Only inside 24 hours of their last message; outside it only when HUMAN_AGENT was passed
 * explicitly (and then up to 7 days). No known inbound message = no window at all.
 */
export const checkMessagingWindow = (lastUserAt: number | null, now: number, tag?: MessageTag): WindowVerdict => {
  if (lastUserAt === null) return { ok: false, reason: "no_user_message" };
  const age = now - lastUserAt;
  if (age <= STANDARD_WINDOW_MS) return { ok: true, via: "standard" };
  if (tag === "HUMAN_AGENT") return age <= HUMAN_AGENT_WINDOW_MS ? { ok: true, via: "human_agent" } : { ok: false, reason: "human_agent_expired" };
  return { ok: false, reason: "window_expired" };
};

export type PrivateReplyVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: "already_replied" | "comment_age_unknown" | "private_reply_expired" };

export const checkPrivateReply = (commentAt: number | null, alreadyReplied: boolean, now: number): PrivateReplyVerdict => {
  if (alreadyReplied) return { ok: false, reason: "already_replied" };
  if (commentAt === null) return { ok: false, reason: "comment_age_unknown" };
  return now - commentAt <= PRIVATE_REPLY_WINDOW_MS ? { ok: true } : { ok: false, reason: "private_reply_expired" };
};

/** Messenger text messages are limited to 2000 characters, Instagram ones to 1000 bytes (UTF-8). */
export const MESSENGER_MAX_CHARS = 2000;
export const INSTAGRAM_MAX_BYTES = 1000;

const fits = (platform: MetaPlatform, s: string): boolean => (platform === "facebook" ? s.length <= MESSENGER_MAX_CHARS : Buffer.byteLength(s, "utf8") <= INSTAGRAM_MAX_BYTES);

/** Split a long text into messages the platform accepts, at a paragraph, line or space when it can. */
export const chunkText = (platform: MetaPlatform, text: string): Array<string> => {
  const rest0 = text.trim();
  const out: Array<string> = [];
  let rest = rest0;
  while (rest.length > 0) {
    if (fits(platform, rest)) {
      out.push(rest);
      break;
    }
    let cut = rest.length;
    while (cut > 1 && !fits(platform, rest.slice(0, cut))) cut = Math.floor(cut * 0.9) || 1;
    // grow back toward the limit, one character at a time
    while (cut < rest.length && fits(platform, rest.slice(0, cut + 1))) cut += 1;
    const head = rest.slice(0, cut);
    const at = Math.max(head.lastIndexOf("\n\n"), head.lastIndexOf("\n"), head.lastIndexOf(". "), head.lastIndexOf(" "));
    const end = at > cut * 0.5 ? at + 1 : cut;
    out.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  return out.filter((x) => x.length > 0);
};

/* ------------------------------------------------------------------ rate limit */

/**
 * A sliding-window limiter per key (the Page id). In memory: it protects one server process from bursting a Page into Meta's own limits
 * (which are per Page and per app); the authoritative limit stays Meta's, whose error is mapped to `rate_limited`.
 */
export type RateLimiter = { take(key: string, now?: number): boolean; remaining(key: string, now?: number): number };

export const createRateLimiter = (max: number, windowMs: number): RateLimiter => {
  const hits = new Map<string, Array<number>>();
  const live = (key: string, now: number): Array<number> => {
    const kept = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (kept.length) hits.set(key, kept);
    else hits.delete(key);
    return kept;
  };
  return {
    take: (key, now = Date.now()) => {
      const kept = live(key, now);
      if (kept.length >= max) return false;
      kept.push(now);
      hits.set(key, kept);
      return true;
    },
    remaining: (key, now = Date.now()) => Math.max(0, max - live(key, now).length),
  };
};

/* ------------------------------------------------------------------ Graph errors */

export type MetaFailure =
  | "window_expired" | "no_user_message" | "human_agent_expired" | "already_replied" | "comment_age_unknown" | "private_reply_expired"
  | "rate_limited" | "token" | "permission" | "not_found" | "recipient_unavailable" | "empty_text" | "not_connected" | "error";

/** Graph error codes -> a reason. Best effort from Meta's published error reference; an unknown code is `error` with the raw text kept in the log. */
export const classifyGraphError = (e: { status?: number; code?: number | null; subcode?: number | null; message?: string }): MetaFailure => {
  const code = e.code ?? null;
  const sub = e.subcode ?? null;
  if (code === 190 || e.status === 401) return "token";
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80006 || code === 80002 || e.status === 429) return "rate_limited";
  if (code === 10 && sub === 2018278) return "window_expired";
  if (code === 551 || (code === 100 && sub === 2018001) || sub === 2018108) return "recipient_unavailable";
  if (code === 10 || code === 200 || (code !== null && code >= 200 && code < 300)) return "permission";
  if (/already.*(replied|private)|private.*already/i.test(e.message ?? "")) return "already_replied";
  if (code === 100 && (sub === 33 || e.status === 404)) return "not_found";
  return "error";
};
