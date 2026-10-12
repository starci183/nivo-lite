import "server-only";
import type { Db } from "./core";
import { decryptSecret, encryptSecret, publicSiteUrl } from "./channels";
import {
  INSTAGRAM_FIELDS, META_SCOPES, PAGE_FIELDS, HOUR_MS, chunkText, checkMessagingWindow, checkPrivateReply, classifyGraphError, createRateLimiter,
  dialogUrl, graphUrl, metaApp, parseLead, redirectUri, webhookUrl,
  type MessageTag, type MetaFailure, type MetaLead, type MetaPlatform,
} from "./meta-core";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Meta: Facebook Pages and Instagram professional accounts, over the Graph API (plain fetch, no SDK).
 *
 * ---------------------------------------------------------------------------------------------------------------------------------
 * META PLATFORM RULES THIS FILE RELIES ON (check them again at https://developers.facebook.com/docs/messenger-platform when upgrading)
 * ---------------------------------------------------------------------------------------------------------------------------------
 * Messaging window. A Page (or Instagram account) may send a message to a person only as a RESPONSE, within 24 hours of the person's
 * last message to it ("standard messaging"). After that window the only free-form option is the `HUMAN_AGENT` message tag: a real person
 * answering, up to 7 days after the person's last message. Promotional or automated messages outside the window are not allowed. So
 * sendMessage refuses outside 24 hours unless the caller passes tag HUMAN_AGENT explicitly (and then refuses beyond 7 days); NIVO never
 * adds that tag by itself. The person's last message time is kept per thread in `meta_threads`.
 * Comments. A public reply to a comment is a normal Graph write (`/{comment-id}/comments` on Facebook, `/{comment-id}/replies` on
 * Instagram). A PRIVATE reply (a message to the commenter, opened by the comment) is allowed ONCE per comment and only within 7 days
 * of the comment; the sender is the Page itself, so it needs `pages_messaging`. The "once" is claimed atomically in `meta_comments`
 * before the call, so two workers cannot both send it.
 * Limits. Messages are 2000 characters (Messenger) or 1000 bytes (Instagram); longer text is split into several messages. Meta
 * rate-limits per Page and per app (error codes 4, 17, 32, 613 and 80006...); this file also caps sends per Page per minute
 * (META_SEND_PER_MINUTE, default 60) and private replies per Page per hour (750) so a burst never reaches Meta's limits.
 * Webhooks. One webhook URL for the whole app; Meta signs each POST with `X-Hub-Signature-256` (HMAC-SHA256 of the raw body with the
 * app secret) and retries until it gets a 200. Facebook events come as object "page" (messaging, feed comments, leadgen); Instagram
 * events as object "instagram" (messaging, comments, mentions). A Page must ALSO be subscribed (`/{page-id}/subscribed_apps`) or Meta
 * sends it nothing; Instagram messaging arrives through the linked Page's subscription.
 * Tokens. The owner logs in once; the long-lived user token is exchanged for the Page access token, which does not expire while the
 * app, the user's role and the permissions stay valid. Only the Page token is kept (AES-256-GCM, connection_secrets); the user token
 * is dropped as soon as the owner picks the Page. A token error (code 190) means the owner must connect again.
 *
 * ---------------------------------------------------------------------------------------------------------------------------------
 * GOING LIVE: APP REVIEW AND BUSINESS VERIFICATION
 * ---------------------------------------------------------------------------------------------------------------------------------
 * While the Meta app is in DEVELOPMENT mode only people with a role on the app (admin, developer, tester) can log in, and only the
 * Pages/Instagram accounts those people manage deliver real traffic; everyone else's messages are not delivered to the webhook.
 * To serve other businesses the app must be switched to LIVE, which needs:
 *   1. Business Verification of the Meta Business that owns the app (legal documents; Tech Provider / Advanced Access).
 *   2. App Review with Advanced Access for every permission asked here: pages_show_list, pages_manage_metadata, pages_messaging,
 *      pages_read_engagement, pages_manage_engagement, leads_retrieval, instagram_basic, instagram_manage_messages,
 *      instagram_manage_comments, business_management; each with a screencast of the feature, the privacy policy URL, and for
 *      messaging the "Human Agent" feature if HUMAN_AGENT is to be used.
 *   3. Data Use Checkup yearly, a data deletion callback or instructions URL, and the app icon, category and privacy policy.
 * Until then NIVO shows the connector as early access and the wizard works for app role users only.
 *
 * Every send below only enforces the PLATFORM's rules. Whether an agent may send at all (access level, authority limits, approval)
 * is decided by the caller's authority gate before it calls these helpers; they never replace it.
 */

const SEND_PER_MINUTE = Math.max(1, Number(process.env.META_SEND_PER_MINUTE) || 60);
const sendLimiter = createRateLimiter(SEND_PER_MINUTE, 60_000);
const privateReplyLimiter = createRateLimiter(750, HOUR_MS);

/* ------------------------------------------------------------------ Graph client */

export class MetaGraphError extends Error {
  constructor(readonly status: number, readonly code: number | null, readonly subcode: number | null, message: string, readonly type: string | null = null) {
    super(message);
  }
  get failure(): MetaFailure {
    return classifyGraphError({ status: this.status, code: this.code, subcode: this.subcode, message: this.message });
  }
}

type Params = Readonly<Record<string, string | number | boolean | undefined>>;
type GraphOptions = { readonly token?: string; readonly method?: "GET" | "POST" | "DELETE"; readonly params?: Params; readonly body?: unknown; readonly timeoutMs?: number };

/** One Graph call. The token travels as `access_token` (never logged); a Graph error becomes a MetaGraphError with Meta's code and subcode. */
export const graph = async <T,>(path: string, opts: GraphOptions = {}): Promise<T> => {
  const method = opts.method ?? "GET";
  const url = graphUrl(path, { ...opts.params, ...(opts.token ? { access_token: opts.token } : {}) });
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      ...(opts.body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(opts.body) } : {}),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new MetaGraphError(0, null, null, e instanceof Error ? e.message : "network error");
  }
  const json = (await res.json().catch(() => null)) as ({ error?: { message?: string; type?: string; code?: number; error_subcode?: number } } & Record<string, unknown>) | null;
  if (!res.ok || json?.error) {
    const e = json?.error;
    throw new MetaGraphError(res.status, e?.code ?? null, e?.error_subcode ?? null, e?.message ?? `Graph ${res.status}`, e?.type ?? null);
  }
  return json as T;
};

/* ------------------------------------------------------------------ stored credential */

/**
 * The credential (one AES-256-GCM blob). While the owner is choosing: the long-lived user token and the Pages it manages, each with its own
 * Page token. After the choice: only the chosen Page and its token.
 */
export type MetaPageChoice = { readonly id: string; readonly name: string; readonly category: string | null; readonly token: string; readonly ig: { readonly id: string; readonly username: string | null; readonly name: string | null } | null };
export type MetaSecret = { userToken?: string; pages?: Array<MetaPageChoice>; pageId?: string; pageToken?: string };

export type MetaPage = {
  readonly connectionId: string;
  readonly workspaceId: string;
  readonly pageId: string;
  readonly pageName: string;
  readonly igId: string | null;
  readonly igUsername: string | null;
  readonly pageToken: string;
};

export const loadMetaSecret = async (connectionId: string): Promise<{ secret: MetaSecret; workspaceId: string; status: string; meta: Record<string, string> } | null> => {
  const db = supabaseAdmin();
  const [{ data: conn }, { data: sec }] = await Promise.all([
    db.from("connections").select("workspace_id, status, provider, public_meta").eq("id", connectionId).maybeSingle(),
    db.from("connection_secrets").select("ciphertext").eq("connection_id", connectionId).maybeSingle(),
  ]);
  if (!conn || conn.provider !== "meta" || conn.status === "disconnected" || !sec) return null;
  try {
    return {
      secret: JSON.parse(decryptSecret(sec.ciphertext as string)) as MetaSecret,
      workspaceId: conn.workspace_id as string, status: conn.status as string, meta: (conn.public_meta as Record<string, string> | null) ?? {},
    };
  } catch (e) {
    console.error("meta credential could not be read", e instanceof Error ? e.message : e);
    return null;
  }
};

export const saveMetaSecret = async (connectionId: string, secret: MetaSecret): Promise<void> => {
  const { error } = await supabaseAdmin().from("connection_secrets").update({ ciphertext: encryptSecret(JSON.stringify(secret)) }).eq("connection_id", connectionId);
  if (error) throw new Error(error.message);
};

/** The chosen Page of a connection with its token, or null while no Page is chosen / the connection is gone. */
export const loadMetaPage = async (connectionId: string): Promise<MetaPage | null> => {
  const found = await loadMetaSecret(connectionId);
  if (!found?.secret.pageToken || !found.secret.pageId) return null;
  return {
    connectionId, workspaceId: found.workspaceId, pageId: found.secret.pageId, pageToken: found.secret.pageToken,
    pageName: found.meta.page_name ?? "", igId: found.meta.ig_id || null, igUsername: found.meta.ig_username || null,
  };
};

/* ------------------------------------------------------------------ login (Facebook Login for Business) */

/**
 * The Meta login URL. With META_LOGIN_CONFIG_ID (a Facebook Login for Business configuration holding these permissions) the dialog uses
 * `config_id`; without it the classic `scope` list is sent. `state` is signed by the caller.
 */
export const authorizeUrl = (state: string): string | null => {
  const app = metaApp();
  if (!app) return null;
  const configId = (process.env.META_LOGIN_CONFIG_ID ?? "").trim();
  return dialogUrl({
    client_id: app.appId, redirect_uri: redirectUri(), state, response_type: "code",
    ...(configId ? { config_id: configId, override_default_response_type: "true" } : { scope: META_SCOPES.join(",") }),
  });
};

/** code -> short-lived user token -> long-lived user token (about 60 days; the Page tokens made from it do not expire). */
export const exchangeCode = async (code: string): Promise<string> => {
  const app = metaApp();
  if (!app) throw new Error("META_APP_ID / META_APP_SECRET are not set");
  const short = await graph<{ access_token: string }>("oauth/access_token", { params: { client_id: app.appId, client_secret: app.appSecret, redirect_uri: redirectUri(), code } });
  const long = await graph<{ access_token: string }>("oauth/access_token", {
    params: { grant_type: "fb_exchange_token", client_id: app.appId, client_secret: app.appSecret, fb_exchange_token: short.access_token },
  }).catch(() => null);
  return long?.access_token ?? short.access_token;
};

type AccountRow = { id: string; name?: string; category?: string; access_token?: string; instagram_business_account?: { id: string; username?: string; name?: string } };

/** The Pages the user manages, with their Page tokens and linked Instagram professional account (follows paging, at most 200 Pages). */
export const listPages = async (userToken: string): Promise<Array<MetaPageChoice>> => {
  const out: Array<MetaPageChoice> = [];
  let after: string | undefined;
  for (let i = 0; i < 4; i += 1) {
    const res = await graph<{ data: Array<AccountRow>; paging?: { cursors?: { after?: string }; next?: string } }>("me/accounts", {
      token: userToken, params: { fields: "id,name,category,access_token,instagram_business_account{id,username,name}", limit: 50, ...(after ? { after } : {}) },
    });
    for (const p of res.data ?? []) {
      if (!p.id || !p.access_token) continue;
      const ig = p.instagram_business_account;
      out.push({ id: p.id, name: p.name ?? p.id, category: p.category ?? null, token: p.access_token, ig: ig?.id ? { id: ig.id, username: ig.username ?? null, name: ig.name ?? null } : null });
    }
    after = res.paging?.next ? res.paging.cursors?.after : undefined;
    if (!after) break;
  }
  return out;
};

/* ------------------------------------------------------------------ webhook subscriptions */

/** The app access token: only for the app-level subscription calls. */
const appToken = (): string | null => {
  const app = metaApp();
  return app ? `${app.appId}|${app.appSecret}` : null;
};

/** Subscribe the Page to the app's webhook fields: messages, messaging_postbacks, feed, leadgen. */
export const subscribePage = async (pageId: string, pageToken: string): Promise<void> => {
  await graph<{ success: boolean }>(`${pageId}/subscribed_apps`, { token: pageToken, method: "POST", params: { subscribed_fields: PAGE_FIELDS.join(",") } });
};

export const unsubscribePage = async (pageId: string, pageToken: string): Promise<void> => {
  await graph<{ success: boolean }>(`${pageId}/subscribed_apps`, { token: pageToken, method: "DELETE" });
};

/**
 * Point the app's webhook (objects page and instagram) at /api/connections/meta/webhook with our verify token. Meta calls the URL back to
 * verify it, so it needs the public https address; on localhost the owner of the Meta app sets it by hand in the dashboard.
 */
export const ensureAppSubscriptions = async (): Promise<{ done: boolean; reason?: "local" | "not_configured" | "no_verify_token" }> => {
  const token = appToken();
  const app = metaApp();
  const verify = (process.env.META_WEBHOOK_VERIFY_TOKEN ?? "").trim();
  if (!token || !app) return { done: false, reason: "not_configured" };
  if (!verify) return { done: false, reason: "no_verify_token" };
  if (!publicSiteUrl()) return { done: false, reason: "local" };
  const callback = webhookUrl();
  await graph(`${app.appId}/subscriptions`, { token, method: "POST", params: { object: "page", callback_url: callback, fields: PAGE_FIELDS.join(","), verify_token: verify, include_values: true } });
  await graph(`${app.appId}/subscriptions`, { token, method: "POST", params: { object: "instagram", callback_url: callback, fields: INSTAGRAM_FIELDS.join(","), verify_token: verify, include_values: true } });
  return { done: true };
};

export type MetaSubscriptionStatus = {
  /** The Page is subscribed to our app, and which fields. */
  readonly page: { readonly subscribed: boolean; readonly fields: ReadonlyArray<string>; readonly missing: ReadonlyArray<string> };
  /** The app's own webhook subscription (callback URL and fields), per object; null when it could not be read. */
  readonly app: { readonly page: AppObject | null; readonly instagram: AppObject | null } | null;
};
export type AppObject = { readonly callbackUrl: string; readonly fields: ReadonlyArray<string>; readonly missing: ReadonlyArray<string>; readonly urlMatches: boolean };

const missingOf = (want: ReadonlyArray<string>, have: ReadonlyArray<string>): Array<string> => want.filter((f) => !have.includes(f));

/** What Meta really has: the Page subscription (Page token) and the app subscription (app token). */
export const subscriptionStatus = async (page: Pick<MetaPage, "pageId" | "pageToken">): Promise<MetaSubscriptionStatus> => {
  const app = metaApp();
  const [pageRes, appRes] = await Promise.all([
    graph<{ data: Array<{ id?: string; subscribed_fields?: Array<string> }> }>(`${page.pageId}/subscribed_apps`, { token: page.pageToken }),
    appToken() && app ? graph<{ data: Array<{ object: string; callback_url?: string; active?: boolean; fields?: Array<{ name: string }> }> }>(`${app.appId}/subscriptions`, { token: appToken() as string }).catch(() => null) : Promise.resolve(null),
  ]);
  const ours = (pageRes.data ?? []).find((a) => a.id === app?.appId) ?? (app ? undefined : (pageRes.data ?? [])[0]);
  const fields = ours?.subscribed_fields ?? [];
  const objectOf = (object: string, want: ReadonlyArray<string>): AppObject | null => {
    const row = appRes?.data?.find((r) => r.object === object);
    if (!row) return null;
    const have = (row.fields ?? []).map((f) => f.name);
    return { callbackUrl: row.callback_url ?? "", fields: have, missing: missingOf(want, have), urlMatches: (row.callback_url ?? "") === webhookUrl() };
  };
  return {
    page: { subscribed: Boolean(ours), fields, missing: missingOf(PAGE_FIELDS, fields) },
    app: appRes ? { page: objectOf("page", PAGE_FIELDS), instagram: objectOf("instagram", INSTAGRAM_FIELDS) } : null,
  };
};

/* ------------------------------------------------------------------ threads and comments (the platform windows) */

/** The person wrote to the Page: the 24 hour window opens (or moves forward) at `at`. */
export const touchThread = async (connectionId: string, platform: MetaPlatform, userId: string, at: number): Promise<void> => {
  const db = supabaseAdmin();
  const { data } = await db.from("meta_threads").select("last_user_at").eq("connection_id", connectionId).eq("platform", platform).eq("user_id", userId).maybeSingle<{ last_user_at: string }>();
  if (data && Date.parse(data.last_user_at) >= at) return;
  const { error } = await db.from("meta_threads").upsert({ connection_id: connectionId, platform, user_id: userId, last_user_at: new Date(at).toISOString() }, { onConflict: "connection_id,platform,user_id" });
  if (error) console.error("meta thread not saved", error.message);
};

export const lastUserMessageAt = async (connectionId: string, platform: MetaPlatform, userId: string): Promise<number | null> => {
  const { data } = await supabaseAdmin().from("meta_threads").select("last_user_at").eq("connection_id", connectionId).eq("platform", platform).eq("user_id", userId).maybeSingle<{ last_user_at: string }>();
  return data ? Date.parse(data.last_user_at) : null;
};

/** A comment arrived: remember its time (private replies last 7 days from it). Idempotent; never resets an answered comment. */
export const noteComment = async (connectionId: string, platform: MetaPlatform, commentId: string, at: number): Promise<void> => {
  const { error } = await supabaseAdmin().from("meta_comments").upsert(
    { connection_id: connectionId, comment_id: commentId, platform, comment_at: new Date(at).toISOString() },
    { onConflict: "connection_id,comment_id", ignoreDuplicates: true },
  );
  if (error) console.error("meta comment not saved", error.message);
};

/* ------------------------------------------------------------------ sends */

export type SendResult = { readonly ok: true; readonly ids: ReadonlyArray<string>; /** a private reply: the PSID / IGSID of the commenter the message reached (links a comment to the later DM thread) */ readonly recipientId?: string } | { readonly ok: false; readonly reason: MetaFailure; readonly detail?: string };
const refuse = (reason: MetaFailure, detail?: string): SendResult => ({ ok: false, reason, ...(detail ? { detail } : {}) });

const failed = (e: unknown): SendResult => {
  if (e instanceof MetaGraphError) {
    console.error("meta send failed", e.failure, e.code, e.subcode, e.message);
    return refuse(e.failure, e.message);
  }
  console.error("meta send failed", e instanceof Error ? e.message : e);
  return refuse("error");
};

export type SendOptions = { readonly tag?: MessageTag; readonly now?: number };

const sendOn = async (platform: MetaPlatform, page: MetaPage, recipientId: string, text: string, opts: SendOptions): Promise<SendResult> => {
  const now = opts.now ?? Date.now();
  if (!text.trim()) return refuse("empty_text");
  if (platform === "instagram" && !page.igId) return refuse("not_connected", "no Instagram account linked to this Page");
  const verdict = checkMessagingWindow(await lastUserMessageAt(page.connectionId, platform, recipientId), now, opts.tag);
  if (!verdict.ok) return refuse(verdict.reason);
  const chunks = chunkText(platform, text);
  const ids: Array<string> = [];
  for (const chunk of chunks) {
    if (!sendLimiter.take(page.pageId, now)) return refuse("rate_limited", ids.length ? `sent ${ids.length} of ${chunks.length} parts` : undefined);
    try {
      const res = await graph<{ message_id?: string }>(`${page.pageId}/messages`, {
        token: page.pageToken, method: "POST",
        body: {
          recipient: { id: recipientId },
          ...(verdict.via === "human_agent" ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" } : { messaging_type: "RESPONSE" }),
          message: { text: chunk },
        },
      });
      if (res.message_id) ids.push(res.message_id);
    } catch (e) {
      return failed(e);
    }
  }
  return { ok: true, ids };
};

/**
 * Messenger: send `text` to a person (PSID) of the Page. Refused outside the 24 hour standard window unless `tag: "HUMAN_AGENT"` is passed
 * explicitly (then up to 7 days). Long text is split. The caller's authority gate decides whether the send may happen at all.
 */
export const sendMessage = (page: MetaPage, recipient: string | { readonly id: string }, text: string, opts: SendOptions = {}): Promise<SendResult> =>
  sendOn("facebook", page, typeof recipient === "string" ? recipient : recipient.id, text, opts);

/** Instagram Direct: the same, to an Instagram-scoped id (IGSID), through the Page the account is linked to. */
export const sendInstagramMessage = (page: MetaPage, recipient: string | { readonly id: string }, text: string, opts: SendOptions = {}): Promise<SendResult> =>
  sendOn("instagram", page, typeof recipient === "string" ? recipient : recipient.id, text, opts);

const replyOn = async (platform: MetaPlatform, page: MetaPage, commentId: string, text: string, now: number): Promise<SendResult> => {
  if (!text.trim()) return refuse("empty_text");
  if (platform === "instagram" && !page.igId) return refuse("not_connected", "no Instagram account linked to this Page");
  if (!sendLimiter.take(page.pageId, now)) return refuse("rate_limited");
  try {
    const res = await graph<{ id?: string }>(`${commentId}/${platform === "facebook" ? "comments" : "replies"}`, {
      token: page.pageToken, method: "POST", params: { message: text.trim().slice(0, platform === "facebook" ? 8000 : 2200) },
    });
    return { ok: true, ids: res.id ? [res.id] : [] };
  } catch (e) {
    return failed(e);
  }
};

/** A PUBLIC reply under a Facebook comment (everyone sees it). */
export const replyToComment = (page: MetaPage, commentId: string, text: string, opts: { readonly now?: number } = {}): Promise<SendResult> =>
  replyOn("facebook", page, commentId, text, opts.now ?? Date.now());

/** A PUBLIC reply under an Instagram comment. */
export const replyToInstagramComment = (page: MetaPage, commentId: string, text: string, opts: { readonly now?: number } = {}): Promise<SendResult> =>
  replyOn("instagram", page, commentId, text, opts.now ?? Date.now());

const privateOn = async (platform: MetaPlatform, page: MetaPage, commentId: string, text: string, opts: { readonly now?: number; readonly commentAt?: number }): Promise<SendResult> => {
  const now = opts.now ?? Date.now();
  if (!text.trim()) return refuse("empty_text");
  if (platform === "instagram" && !page.igId) return refuse("not_connected", "no Instagram account linked to this Page");
  const db = supabaseAdmin();
  const { data: row } = await db.from("meta_comments").select("comment_at, private_replied_at").eq("connection_id", page.connectionId).eq("comment_id", commentId).maybeSingle<{ comment_at: string | null; private_replied_at: string | null }>();
  const commentAt = row?.comment_at ? Date.parse(row.comment_at) : opts.commentAt ?? null;
  const verdict = checkPrivateReply(commentAt, Boolean(row?.private_replied_at), now);
  if (!verdict.ok) return refuse(verdict.reason);
  if (!row) await noteComment(page.connectionId, platform, commentId, commentAt as number);
  if (!privateReplyLimiter.take(page.pageId, now) || !sendLimiter.take(page.pageId, now)) return refuse("rate_limited");
  // Claim "the one private reply" before sending: whoever updates the row from null wins; the loser sees no row back.
  const claim = await db.from("meta_comments").update({ private_replied_at: new Date(now).toISOString() })
    .eq("connection_id", page.connectionId).eq("comment_id", commentId).is("private_replied_at", null).select("comment_id");
  if (claim.error || !claim.data?.length) return refuse("already_replied");
  try {
    const res = await graph<{ message_id?: string; recipient_id?: string }>(`${page.pageId}/messages`, {
      token: page.pageToken, method: "POST",
      body: { recipient: { comment_id: commentId }, message: { text: chunkText(platform, text)[0] ?? text.trim() } },
    });
    return { ok: true, ids: res.message_id ? [res.message_id] : [], ...(res.recipient_id ? { recipientId: res.recipient_id } : {}) };
  } catch (e) {
    // Meta said it already was answered: keep the claim. Any other failure gives the one reply back.
    const failure = e instanceof MetaGraphError ? e.failure : "error";
    if (failure !== "already_replied") await db.from("meta_comments").update({ private_replied_at: null }).eq("connection_id", page.connectionId).eq("comment_id", commentId);
    return failed(e);
  }
};

/** A PRIVATE reply to a Facebook comment: a Messenger message to the commenter, once per comment, within 7 days of it. */
export const privateReply = (page: MetaPage, commentId: string, text: string, opts: { readonly now?: number; readonly commentAt?: number } = {}): Promise<SendResult> =>
  privateOn("facebook", page, commentId, text, opts);

/** The same for an Instagram comment. */
export const privateReplyInstagram = (page: MetaPage, commentId: string, text: string, opts: { readonly now?: number; readonly commentAt?: number } = {}): Promise<SendResult> =>
  privateOn("instagram", page, commentId, text, opts);

/* ------------------------------------------------------------------ lead ads and profiles */

/** GET /{leadgen_id}: the answers of one lead-form submission (needs leads_retrieval and the Page token). */
export const fetchLead = async (page: Pick<MetaPage, "pageToken">, leadgenId: string): Promise<MetaLead> =>
  parseLead(await graph<unknown>(leadgenId, { token: page.pageToken, params: { fields: "id,created_time,ad_id,form_id,field_data" } }));

/** The person's display name (Messenger: name; Instagram: name or username), or null when Meta does not give it. */
export const fetchProfileName = async (page: Pick<MetaPage, "pageToken">, platform: MetaPlatform, userId: string): Promise<string | null> => {
  try {
    const r = await graph<{ name?: string; username?: string; first_name?: string; last_name?: string }>(userId, {
      token: page.pageToken, params: { fields: platform === "facebook" ? "name,first_name,last_name" : "name,username" }, timeoutMs: 5000,
    });
    return r.name?.trim() || [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.username?.trim() || null;
  } catch {
    return null;
  }
};

/** The text of an Instagram comment or caption that mentioned the account (the mentions webhook carries only ids). */
export const fetchMention = async (page: Pick<MetaPage, "pageToken" | "igId">, commentId: string): Promise<{ text: string | null; username: string | null }> => {
  if (!page.igId) return { text: null, username: null };
  try {
    const r = await graph<{ mentioned_comment?: { text?: string; username?: string } }>(page.igId, {
      token: page.pageToken, params: { fields: `mentioned_comment.comment_id(${commentId}){text,username}` }, timeoutMs: 5000,
    });
    return { text: r.mentioned_comment?.text ?? null, username: r.mentioned_comment?.username ?? null };
  } catch {
    return { text: null, username: null };
  }
};

/* ------------------------------------------------------------------ delivery of a conversation's reply */

export type MetaDeliveryFailure = `meta_${MetaFailure}`;

type Conv = { id: string; workspace_id: string; channel: string | null; connection_id: string | null; external_id: string | null };

const markMessage = async (db: Db, convId: string, text: string, failure: MetaDeliveryFailure | null): Promise<void> => {
  const { data } = await db.from("agent_messages").select("id").eq("conversation_id", convId).eq("role", "agent").eq("body", text).is("delivery_status", null)
    .order("created_at", { ascending: false }).limit(1);
  const id = (data as Array<{ id: string }> | null)?.[0]?.id;
  if (!id) return;
  await db.from("agent_messages").update(failure ? { delivery_status: "failed", delivery_error: failure } : { delivery_status: "sent", delivery_error: null }).eq("id", id);
};

/**
 * Send the company's reply of a Facebook / Instagram conversation to the person, through the connection it came in on. A conversation
 * opened by a comment (external id `comment:<id>`) is answered with the one private reply; a Messenger / Direct one with a normal message
 * inside the 24 hour window. The reason of a refusal is written on the stored message. Never throws; true only when Meta accepted it.
 * This runs AFTER the caller's authority gate (deliverToChannel is only called for replies the gate let through).
 */
export const deliverMeta = async (db: Db, conv: Conv, text: string): Promise<boolean> => {
  const platform: MetaPlatform = conv.channel === "instagram" ? "instagram" : "facebook";
  const fail = async (reason: MetaFailure, detail?: unknown): Promise<false> => {
    if (detail) console.error("meta delivery failed", reason, detail instanceof Error ? detail.message : detail);
    await markMessage(db, conv.id, text, `meta_${reason}`).catch(() => null);
    return false;
  };
  if (!conv.connection_id || !conv.external_id) return fail("not_connected");
  const page = await loadMetaPage(conv.connection_id).catch(() => null);
  if (!page || page.workspaceId !== conv.workspace_id) return fail("not_connected");
  const res = conv.external_id.startsWith("comment:")
    ? await (platform === "instagram" ? privateReplyInstagram : privateReply)(page, conv.external_id.slice("comment:".length), text)
    : await (platform === "instagram" ? sendInstagramMessage : sendMessage)(page, conv.external_id.split(":")[0], text);
  if (!res.ok) return fail(res.reason);
  await markMessage(db, conv.id, text, null).catch(() => null);
  return true;
};
