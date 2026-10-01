import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { safeEqual } from "./channels";

/**
 * The one place that talks to Zalo. Hosts default to the real ones and can be pointed at a local fake with
 * ZALO_OAUTH_BASE / ZALO_API_BASE (scripts/zalo-mock-e2e.mjs). Nothing here touches the database or logs a secret.
 *
 *   Authorization   GET  {OAUTH}/v4/oa/permission?app_id&redirect_uri&code_challenge&state      (PKCE, S256 = base64url(sha256(verifier)))
 *   Token + refresh POST {OAUTH}/v4/oa/access_token   header secret_key=<App Secret>, form: code|refresh_token, app_id, grant_type, code_verifier
 *   Send (CS)       POST {API}/v3.0/oa/message/cs     header access_token, json {recipient:{user_id}, message:{text}}
 *   User detail     GET  {API}/v3.0/oa/user/detail?data={"user_id":".."}   header access_token
 *   Webhook         X-ZEvent-Signature: mac=<hex sha256(app_id + rawBody + timestamp + OA Secret Key)>
 */
export const zaloOauthBase = (): string => (process.env.ZALO_OAUTH_BASE || "https://oauth.zaloapp.com").replace(/\/$/, "");
export const zaloApiBase = (): string => (process.env.ZALO_API_BASE || "https://openapi.zalo.me").replace(/\/$/, "");

/** Lifetimes from the docs: access token 1 hour, refresh token 3 months and single use. */
export const ACCESS_FALLBACK_SECONDS = 3600;
export const REFRESH_TTL_MS = 90 * 86_400_000;

export type ZaloTokens = { readonly accessToken: string; readonly refreshToken: string; readonly expiresInSeconds: number };

/** A Zalo failure with its numeric code (Zalo answers HTTP 200 with a non-zero `error`), so callers can tell a closed window from a dead token. */
export class ZaloError extends Error {
  constructor(message: string, readonly code: number | null = null) {
    super(message);
  }
}

export const newVerifier = (): string => randomBytes(48).toString("base64url");
export const challengeOf = (verifier: string): string => createHash("sha256").update(verifier).digest("base64url");

export const authorizeUrl = (appId: string, redirectUri: string, verifier: string, state: string): string => {
  const q = new URLSearchParams({ app_id: appId, redirect_uri: redirectUri, code_challenge: challengeOf(verifier), state });
  return `${zaloOauthBase()}/v4/oa/permission?${q.toString()}`;
};

type TokenBody = { access_token?: string; refresh_token?: string; expires_in?: string | number; error?: number | string; error_name?: string; error_reason?: string; error_description?: string; message?: string };

const tokenCall = async (secret: string, form: Record<string, string>): Promise<ZaloTokens> => {
  const res = await fetch(`${zaloOauthBase()}/v4/oa/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", secret_key: secret },
    body: new URLSearchParams(form).toString(),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as TokenBody | null;
  if (!json?.access_token || !json.refresh_token) {
    const code = Number(json?.error);
    throw new ZaloError(`zalo token: ${json?.error_description ?? json?.error_reason ?? json?.error_name ?? json?.message ?? res.status}`, Number.isFinite(code) ? code : null);
  }
  const seconds = Number(json.expires_in);
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresInSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : ACCESS_FALLBACK_SECONDS };
};

export const exchangeCode = (appId: string, appSecret: string, code: string, verifier: string): Promise<ZaloTokens> =>
  tokenCall(appSecret, { code, app_id: appId, grant_type: "authorization_code", code_verifier: verifier });

export const refreshTokens = (appId: string, appSecret: string, refreshToken: string): Promise<ZaloTokens> =>
  tokenCall(appSecret, { refresh_token: refreshToken, app_id: appId, grant_type: "refresh_token" });

type ApiBody = { error?: number; message?: string; data?: Record<string, unknown> };

const apiCall = async (accessToken: string, method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> => {
  const res = await fetch(`${zaloApiBase()}${path}`, {
    method,
    headers: { access_token: accessToken, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as ApiBody | null;
  if (!json) throw new ZaloError(`zalo api ${path}: HTTP ${res.status}`);
  if (json.error !== undefined && json.error !== 0) throw new ZaloError(`zalo api ${path}: ${json.message ?? json.error}`, Number(json.error));
  return json.data ?? {};
};

/** Send a consultation (CS) text message to one user. Returns Zalo's message id. */
export const sendCsText = async (accessToken: string, userId: string, text: string): Promise<string | null> => {
  const data = await apiCall(accessToken, "POST", "/v3.0/oa/message/cs", { recipient: { user_id: userId }, message: { text } });
  return typeof data.message_id === "string" ? data.message_id : null;
};

/** The customer's display name, or null when Zalo will not say (best effort: the name only labels the conversation). */
export const userDisplayName = async (accessToken: string, userId: string): Promise<string | null> => {
  try {
    const data = await apiCall(accessToken, "GET", `/v3.0/oa/user/detail?data=${encodeURIComponent(JSON.stringify({ user_id: userId }))}`);
    const name = (data.display_name ?? data.user_alias) as unknown;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch (e) {
    console.error("zalo user lookup failed", e instanceof Error ? e.message : e);
    return null;
  }
};

/** `mac=` hex digest of sha256(app_id + raw body + timestamp + OA secret key). Constant-time compare; fails closed on any missing piece. */
export const verifyWebhookSignature = (header: string | null, appId: string, rawBody: string, oaSecret: string): boolean => {
  if (!header || !appId || !oaSecret) return false;
  let timestamp: string;
  try {
    const parsed = JSON.parse(rawBody) as { timestamp?: string | number };
    if (parsed.timestamp === undefined || parsed.timestamp === null) return false;
    timestamp = String(parsed.timestamp);
  } catch {
    return false;
  }
  const given = header.trim().replace(/^mac=/i, "").toLowerCase();
  const expected = createHash("sha256").update(`${appId}${rawBody}${timestamp}${oaSecret}`).digest("hex");
  return safeEqual(given, expected);
};

export type ZaloEvent = {
  readonly app_id?: string;
  readonly event_name?: string;
  readonly timestamp?: string | number;
  readonly sender?: { readonly id?: string };
  readonly recipient?: { readonly id?: string };
  readonly follower?: { readonly id?: string };
  readonly message?: { readonly msg_id?: string; readonly text?: string };
  readonly user_id_by_app_id?: string;
};
