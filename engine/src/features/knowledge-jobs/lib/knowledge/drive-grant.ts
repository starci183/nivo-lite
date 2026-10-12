// PORTED from src/lib/knowledge/drive-grant.ts (+ encryptSecret/decryptSecret of src/lib/channels.ts and refreshAccessToken of
// src/lib/google-sheets-core.ts). Keep in sync by hand. Only the read side: driveGrantOf and withDriveToken (the OAuth connect flow stays in the web).
// Same storage: connections (provider 'google_drive') + connection_secrets.ciphertext = AES-256-GCM(JSON {access_token, refresh_token, expires_at}).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeJobsOptions } from "../../knowledge-jobs.config";
import { linkError, LINK_ERROR } from "./drive";

type Db = SupabaseClient;
type Stored = { access_token: string; refresh_token: string; expires_at: number };
type Row = { id: string; status: "pending" | "connected" | "error" | "disconnected"; public_meta: Record<string, string> | null };
export type DriveGrant = { readonly state: "none" | "connected" | "lost"; readonly email: string };
type Opts = Pick<KnowledgeJobsOptions, "channelTokenKey" | "google">;

const REFRESH_MARGIN_MS = 90_000;
const now = () => new Date().toISOString();

const keyOf = (o: Opts): Buffer => {
  if (!o.channelTokenKey) throw new Error("CHANNEL_TOKEN_KEY is not set on the engine: private Drive files cannot be read.");
  return o.channelTokenKey;
};
const encrypt = (o: Opts, plain: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyOf(o), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
};
const decrypt = (o: Opts, stored: string): string => {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", keyOf(o), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
};

const loadRow = async (db: Db, workspaceId: string): Promise<Row | null> => {
  const { data } = await db.from("connections").select("id, status, public_meta").eq("workspace_id", workspaceId).eq("provider", "google_drive").neq("status", "disconnected").order("created_at").limit(1).maybeSingle();
  return (data as Row | null) ?? null;
};

const readSecret = async (db: Db, o: Opts, connectionId: string): Promise<Stored | null> => {
  const { data } = await db.from("connection_secrets").select("ciphertext").eq("connection_id", connectionId).maybeSingle();
  try { return JSON.parse(decrypt(o, (data as { ciphertext: string }).ciphertext)) as Stored; } catch { return null; }
};

const writeSecret = async (db: Db, o: Opts, connectionId: string, stored: Stored): Promise<void> => {
  const upd = await db.from("connection_secrets").update({ ciphertext: encrypt(o, JSON.stringify(stored)) }).eq("connection_id", connectionId).select("connection_id");
  if (upd.error) throw new Error(upd.error.message);
};

export const driveGrantOf = async (db: Db, workspaceId: string): Promise<DriveGrant> => {
  const row = await loadRow(db, workspaceId);
  if (!row || row.status === "pending") return { state: "none", email: "" };
  return { state: row.status === "error" ? "lost" : "connected", email: row.public_meta?.email ?? "" };
};

type GoogleHttpError = Error & { status: number; code: string };
const httpError = (status: number, code: string, message: string): GoogleHttpError =>
  Object.assign(new Error(`google_${status}${code ? `:${code}` : ""} ${message}`.slice(0, 200)), { status, code });

/** google-sheets-core.ts refreshAccessToken, inlined (token endpoint + error shape identical). */
const refreshAccessToken = async (o: Opts, refreshToken: string): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: number }> => {
  const c = o.google;
  if (!c) throw httpError(400, "invalid_client", "client not configured");
  const url = c.oauthBase ? `${c.oauthBase.replace(/\/+$/, "")}/token` : "https://oauth2.googleapis.com/token";
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: c.clientId, client_secret: c.clientSecret, grant_type: "refresh_token" }).toString(),
    });
  } catch (e) {
    throw httpError(0, "network", e instanceof Error ? e.message : "fetch failed");
  }
  const text = await res.text();
  let j: Record<string, unknown> = {};
  try { j = text ? (JSON.parse(text) as Record<string, unknown>) : {}; } catch { /* non-JSON body */ }
  if (!res.ok) {
    const err = j.error as unknown;
    const code = typeof err === "string" ? err : typeof (err as Record<string, unknown> | undefined)?.status === "string" ? String((err as Record<string, unknown>).status) : "";
    throw httpError(res.status, code, typeof j.error_description === "string" ? j.error_description : text.slice(0, 80));
  }
  if (typeof j.access_token !== "string") throw httpError(502, "no_token", "no access token in the response");
  return { accessToken: j.access_token, refreshToken: typeof j.refresh_token === "string" ? j.refresh_token : null, expiresAt: Date.now() + (typeof j.expires_in === "number" ? j.expires_in : 3600) * 1000 };
};

const accessToken = async (db: Db, o: Opts, workspaceId: string, force: boolean): Promise<string> => {
  const row = await loadRow(db, workspaceId);
  if (!row || row.status === "pending") throw linkError(LINK_ERROR.needGrant, "Cần cấp quyền Google Drive.");
  if (row.status === "error") throw linkError(LINK_ERROR.grantLost, "Quyền Google Drive đã bị thu hồi. Hãy cấp lại.");
  const stored = await readSecret(db, o, row.id);
  if (!stored?.refresh_token) throw linkError(LINK_ERROR.grantLost, "Quyền Google Drive đã bị thu hồi. Hãy cấp lại.");
  if (!force && stored.access_token && stored.expires_at - REFRESH_MARGIN_MS > Date.now()) return stored.access_token;
  try {
    const t = await refreshAccessToken(o, stored.refresh_token);
    await writeSecret(db, o, row.id, { access_token: t.accessToken, refresh_token: t.refreshToken ?? stored.refresh_token, expires_at: t.expiresAt });
    return t.accessToken;
  } catch (e) {
    if ((e as GoogleHttpError).code === "invalid_grant") {
      await db.from("connections").update({ status: "error", last_error: "invalid_grant", updated_at: now() }).eq("id", row.id);
      throw linkError(LINK_ERROR.grantLost, "Quyền Google Drive đã bị thu hồi. Hãy cấp lại.");
    }
    throw e instanceof Error ? e : new Error("google_refresh_failed");
  }
};

/** Run `fn` with a valid Drive access token; one forced refresh and retry when Drive answers 401. */
export const withDriveToken = async <T>(db: Db, o: Opts, workspaceId: string, fn: (token: string) => Promise<T>): Promise<T> => {
  const token = await accessToken(db, o, workspaceId, false);
  try {
    return await fn(token);
  } catch (e) {
    if ((e as { status?: number }).status !== 401) throw e;
    return fn(await accessToken(db, o, workspaceId, true));
  }
};
