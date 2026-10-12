import "server-only";
import { createHash } from "node:crypto";
import { decryptSecret, encryptSecret, publicSiteUrl } from "./channels";
import type { Db } from "./core";
import { supabaseAdmin } from "./supabase/admin";
import { REFRESH_TTL_MS, ZaloError, refreshTokens, sendCsText } from "./zalo-api";

/**
 * Zalo OA connection state and delivery.
 * The credential JSON (App ID, App secret, OA secret key, the tokens, a pending PKCE verifier) is one AES-256-GCM blob in
 * connection_secrets.ciphertext; `token_expires_at` and `refresh_lock_until` sit beside it in the clear so the refresh job can find
 * what is due without decrypting everything. A Zalo refresh token works ONCE, so a refresh holds a short database lease: two callers
 * can never both spend the same refresh token (the loser waits and reads the winner's new token).
 */
export type ZaloSecret = {
  appId: string;
  appSecret: string;
  /** The "OA Secret Key" of the app's webhook settings: signs every webhook (not the same value as the App secret). */
  oaSecret: string;
  accessToken?: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  /** A started authorization: the PKCE verifier and the one-time state nonce. */
  pkce?: { verifier: string; nonce: string; exp: number };
};

export const ZALO_RECONNECT = "Zalo OA cần được kết nối lại (token hết hạn hoặc bị thu hồi). Bấm Kết nối lại.";
const SKEW_MS = 5 * 60_000;
const LEASE_MS = 30_000;
/** Consultation messages are free for 48 hours after the customer's last interaction; later ones are paid or refused by Zalo. */
export const ZALO_FREE_WINDOW_MS = 48 * 3_600_000;

type Loaded = { secret: ZaloSecret; expiresAt: number | null; workspaceId: string; status: string };

const load = async (connectionId: string): Promise<Loaded | null> => {
  const db = supabaseAdmin();
  const { data: conn } = await db.from("connections").select("workspace_id, status, provider").eq("id", connectionId).maybeSingle();
  if (!conn || conn.provider !== "zalo_oa" || conn.status === "disconnected") return null;
  const { data: sec } = await db.from("connection_secrets").select("ciphertext, token_expires_at").eq("connection_id", connectionId).maybeSingle();
  if (!sec) return null;
  try {
    return {
      secret: JSON.parse(decryptSecret(sec.ciphertext as string)) as ZaloSecret,
      expiresAt: sec.token_expires_at ? Date.parse(sec.token_expires_at as string) : null,
      workspaceId: conn.workspace_id as string, status: conn.status as string,
    };
  } catch (e) {
    console.error("zalo credential could not be read", e instanceof Error ? e.message : e);
    return null;
  }
};

export const loadZalo = load;

/** The callback URL to register on the Zalo app: Zalo sends the browser back here with ?code&oa_id&state. */
export const zaloCallbackUrl = (): string => `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100").replace(/\/$/, "")}/api/connections/zalo/oauth/callback`;

/** Persist the credential (and optionally its expiry); `release` also drops the refresh lease. */
export const saveZaloSecret = async (connectionId: string, secret: ZaloSecret, opts: { expiresAt?: number | null; release?: boolean } = {}): Promise<void> => {
  const patch: Record<string, unknown> = { ciphertext: encryptSecret(JSON.stringify(secret)) };
  if (opts.expiresAt !== undefined) patch.token_expires_at = opts.expiresAt === null ? null : new Date(opts.expiresAt).toISOString();
  if (opts.release) patch.refresh_lock_until = null;
  const { error } = await supabaseAdmin().from("connection_secrets").update(patch).eq("connection_id", connectionId);
  if (error) throw new Error(error.message);
};

const tryLease = async (connectionId: string): Promise<boolean> => {
  const now = Date.now();
  const { data } = await supabaseAdmin().from("connection_secrets")
    .update({ refresh_lock_until: new Date(now + LEASE_MS).toISOString() })
    .eq("connection_id", connectionId)
    .or(`refresh_lock_until.is.null,refresh_lock_until.lt.${new Date(now).toISOString()}`)
    .select("connection_id");
  return (data ?? []).length > 0;
};

const release = async (connectionId: string): Promise<void> => {
  await supabaseAdmin().from("connection_secrets").update({ refresh_lock_until: null }).eq("connection_id", connectionId);
};

const markError = async (connectionId: string, message: string): Promise<void> => {
  await supabaseAdmin().from("connections").update({ status: "error", last_error: message, updated_at: new Date().toISOString() }).eq("id", connectionId);
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * A working OA access token: the stored one while it has more than 5 minutes left, else refreshed (lazily, on use).
 * `stale` is a token Zalo just rejected: when the stored token is still that one it is refreshed even if its clock says it is fine.
 */
export const getAccessToken = async (connectionId: string, opts: { stale?: string; force?: boolean } = {}): Promise<string> => {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const cur = await load(connectionId);
    if (!cur) throw new Error("zalo connection not available");
    const { secret } = cur;
    const fresh = secret.accessToken && cur.expiresAt !== null && cur.expiresAt - Date.now() > SKEW_MS && secret.accessToken !== opts.stale && !opts.force;
    if (fresh) return secret.accessToken as string;
    if (!secret.refreshToken) throw new ZaloError("zalo connection has no tokens yet (authorize first)");

    if (!(await tryLease(connectionId))) {
      await sleep(500);
      continue;
    }
    try {
      // Another caller may have refreshed between our read and our lease: re-read before spending the refresh token.
      const again = await load(connectionId);
      if (!again) throw new Error("zalo connection not available");
      const s = again.secret;
      if (s.accessToken && again.expiresAt !== null && again.expiresAt - Date.now() > SKEW_MS && s.accessToken !== opts.stale && !opts.force) {
        await release(connectionId);
        return s.accessToken;
      }
      if (!s.refreshToken) throw new ZaloError("zalo connection has no refresh token");
      let tokens;
      try {
        tokens = await refreshTokens(s.appId, s.appSecret, s.refreshToken);
      } catch (e) {
        // Zalo answered and said no: the refresh token is used up, expired or revoked. Only a new authorization fixes that.
        if (e instanceof ZaloError) await markError(connectionId, ZALO_RECONNECT);
        throw e;
      }
      const expiresAt = Date.now() + tokens.expiresInSeconds * 1000;
      const next: ZaloSecret = { ...s, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS).toISOString(), pkce: undefined };
      // The old refresh token is gone the moment Zalo answers: a failed save would lose the connection, so try twice.
      try {
        await saveZaloSecret(connectionId, next, { expiresAt, release: true });
      } catch {
        await saveZaloSecret(connectionId, next, { expiresAt, release: true });
      }
      return tokens.accessToken;
    } catch (e) {
      await release(connectionId).catch(() => null);
      throw e;
    }
  }
  throw new Error("zalo token refresh is busy; try again");
};

/** Refresh every Zalo connection whose access token ends within `withinMs` (the 6-hourly job). Returns how many were refreshed / failed. */
export const refreshDueConnections = async (withinMs = 7 * 3_600_000): Promise<{ refreshed: number; failed: number }> => {
  const db = supabaseAdmin();
  const { data: conns } = await db.from("connections").select("id").eq("provider", "zalo_oa").neq("status", "disconnected");
  const ids = ((conns ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (!ids.length) return { refreshed: 0, failed: 0 };
  const { data: secs } = await db.from("connection_secrets").select("connection_id, token_expires_at").in("connection_id", ids);
  const due = ((secs ?? []) as Array<{ connection_id: string; token_expires_at: string | null }>)
    .filter((s) => s.token_expires_at !== null && Date.parse(s.token_expires_at) - Date.now() < withinMs).map((s) => s.connection_id);
  let refreshed = 0;
  let failed = 0;
  for (const id of due) {
    try {
      await getAccessToken(id, { force: true });
      refreshed += 1;
    } catch (e) {
      failed += 1;
      console.error("zalo scheduled refresh failed", id, e instanceof Error ? e.message : e);
    }
  }
  return { refreshed, failed };
};

/** The bearer the scheduled job presents: derived from the service key, so it needs no extra setting and is never stored in the app. */
export const cronSecret = (): string => createHash("sha256").update(`zalo-cron:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest("hex");

/** Tell pg_cron where to call (public https only; locally the route is called by hand). */
export const registerRefreshTarget = async (): Promise<void> => {
  const origin = publicSiteUrl();
  if (!origin || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { error } = await supabaseAdmin().from("cron_targets").upsert({ name: "zalo-refresh", url: `${origin}/api/connections/zalo/refresh`, secret: cronSecret(), updated_at: new Date().toISOString() });
  if (error) console.error("zalo cron target not saved", error.message);
};

/* ------------------------------------------------------------------ delivery */

export type ZaloFailure = "zalo_window_expired" | "zalo_unfollowed" | "zalo_night_hours" | "zalo_token" | "zalo_not_connected" | "zalo_error";

/** Zalo's numeric errors (from the community docs; unconfirmed ones fall into zalo_error with the raw text in the log). */
const failureOf = (e: unknown): ZaloFailure => {
  const code = e instanceof ZaloError ? e.code : null;
  if (code === -230 || code === -232) return "zalo_window_expired";
  if (code === -213) return "zalo_unfollowed";
  if (code === -234) return "zalo_night_hours";
  if (code === -216 || code === -124 || code === -14014 || code === -14003) return "zalo_token";
  return "zalo_error";
};

const isTokenRejection = (e: unknown): boolean => e instanceof ZaloError && (e.code === -216 || e.code === -124);

type Conv = { id: string; workspace_id: string; connection_id: string | null; external_id: string | null };

/** Record the outcome on the agent message that carried `text` (the newest one without a verdict), so the workbench can show why. */
const markMessage = async (db: Db, conv: Conv, text: string, failure: ZaloFailure | null): Promise<void> => {
  const { data } = await db.from("agent_messages").select("id").eq("conversation_id", conv.id).eq("role", "agent").eq("body", text).is("delivery_status", null)
    .order("created_at", { ascending: false }).limit(1);
  const id = (data as Array<{ id: string }> | null)?.[0]?.id;
  if (!id) return;
  await db.from("agent_messages").update(failure ? { delivery_status: "failed", delivery_error: failure } : { delivery_status: "sent", delivery_error: null }).eq("id", id);
};

/** The customer's last message to the OA (an interaction that opens the free window), or null. */
const lastInteraction = async (db: Db, convId: string): Promise<number | null> => {
  const { data } = await db.from("agent_messages").select("created_at").eq("conversation_id", convId).eq("role", "user").order("created_at", { ascending: false }).limit(1);
  const at = (data as Array<{ created_at: string }> | null)?.[0]?.created_at;
  return at ? Date.parse(at) : null;
};

/**
 * Send `text` to the Zalo user of this conversation through its own connection. Inside the window only; the reason of any failure is
 * written on the stored message ("Quá hạn cửa sổ trả lời của Zalo"). Never throws. True only when Zalo accepted the message.
 */
export const deliverZalo = async (db: Db, conv: Conv, text: string): Promise<boolean> => {
  const fail = async (failure: ZaloFailure, detail?: unknown): Promise<false> => {
    if (detail) console.error("zalo delivery failed", failure, detail instanceof Error ? detail.message : detail);
    await markMessage(db, conv, text, failure).catch(() => null);
    return false;
  };
  if (!conv.connection_id || !conv.external_id) return fail("zalo_not_connected");
  const userId = conv.external_id.split(":")[0];
  const last = await lastInteraction(db, conv.id);
  if (last !== null && Date.now() - last > ZALO_FREE_WINDOW_MS) return fail("zalo_window_expired");
  try {
    let token = await getAccessToken(conv.connection_id);
    try {
      await sendCsText(token, userId, text);
    } catch (e) {
      if (!isTokenRejection(e)) throw e;
      token = await getAccessToken(conv.connection_id, { stale: token });
      await sendCsText(token, userId, text);
    }
    await markMessage(db, conv, text, null).catch(() => null);
    return true;
  } catch (e) {
    return fail(failureOf(e), e);
  }
};
