import "server-only";
import { decryptSecret, encryptSecret, randomSecret } from "../channels";
import { googleStateKey } from "../google";
import {
  accountEmail, buildAuthUrl, DRIVE_PURPOSE, DRIVE_READ_SCOPE, exchangeCode, refreshAccessToken, safeReturnTo, signState,
  type GoogleHttpError, type TokenSet,
} from "../google-sheets-core";
import { supabaseAdmin } from "../supabase/admin";
import { linkError, LINK_ERROR } from "./drive";

/**
 * The Drive read grant of a workspace ("Cấp quyền Google Drive"): one connection of provider 'google_drive' per workspace.
 * Same storage as the Sheets connection: JSON {access_token, refresh_token, expires_at} AES-256-GCM encrypted (CHANNEL_TOKEN_KEY) in
 * connection_secrets.ciphertext; public_meta.email names the Google account. status 'error' + last_error 'invalid_grant' = the owner revoked it.
 * The OAuth start reuses the Sheets callback (/api/connections/google/callback) with purpose=drive_read in the signed state.
 */
type Stored = { access_token: string; refresh_token: string; expires_at: number };
type Row = { id: string; status: "pending" | "connected" | "error" | "disconnected"; public_meta: Record<string, string> | null };
export type DriveGrant = { readonly state: "none" | "connected" | "lost"; readonly email: string };

const REFRESH_MARGIN_MS = 90_000;
const now = () => new Date().toISOString();

const loadRow = async (workspaceId: string): Promise<Row | null> => {
  const { data } = await supabaseAdmin().from("connections").select("id, status, public_meta").eq("workspace_id", workspaceId).eq("provider", "google_drive").neq("status", "disconnected").order("created_at").limit(1).maybeSingle();
  return (data as Row | null) ?? null;
};

const readSecret = async (connectionId: string): Promise<Stored | null> => {
  const { data } = await supabaseAdmin().from("connection_secrets").select("ciphertext").eq("connection_id", connectionId).maybeSingle();
  try { return JSON.parse(decryptSecret((data as { ciphertext: string }).ciphertext)) as Stored; } catch { return null; }
};

const writeSecret = async (connectionId: string, stored: Stored): Promise<void> => {
  const ciphertext = encryptSecret(JSON.stringify(stored));
  const db = supabaseAdmin();
  const upd = await db.from("connection_secrets").update({ ciphertext }).eq("connection_id", connectionId).select("connection_id");
  if (upd.error) throw new Error(upd.error.message);
  if (!upd.data?.length) {
    const ins = await db.from("connection_secrets").insert({ connection_id: connectionId, ciphertext, webhook_secret: randomSecret() });
    if (ins.error) throw new Error(ins.error.message);
  }
};

/** The Google consent URL for the Drive read grant, or null when the Google client is not configured. */
export const driveAuthUrl = (workspaceId: string, userId: string, returnTo: string): string | null =>
  buildAuthUrl(signState(googleStateKey(), { workspaceId, userId, returnTo: safeReturnTo(returnTo), purpose: DRIVE_PURPOSE }), process.env, DRIVE_READ_SCOPE);

export const driveGrantOf = async (workspaceId: string): Promise<DriveGrant> => {
  const row = await loadRow(workspaceId);
  if (!row || row.status === "pending") return { state: "none", email: "" };
  return { state: row.status === "error" ? "lost" : "connected", email: row.public_meta?.email ?? "" };
};

/** Exchange the callback code and store the grant. Throws "scope_missing" when the owner unticked Drive on the consent screen. */
export const completeDriveConnect = async (workspaceId: string, userId: string, code: string): Promise<string | null> => {
  const tokens: TokenSet = await exchangeCode(code);
  if (tokens.scope && !/auth\/drive(\.readonly)?(\s|$)/.test(tokens.scope)) throw new Error("scope_missing");
  const email = await accountEmail(tokens);
  const row = await loadRow(workspaceId);
  const refresh = tokens.refreshToken ?? (row ? (await readSecret(row.id))?.refresh_token ?? null : null);
  if (!refresh) throw new Error("no_refresh_token");
  const stored: Stored = { access_token: tokens.accessToken, refresh_token: refresh, expires_at: tokens.expiresAt };
  const db = supabaseAdmin();
  const name = `Google Drive · ${email ?? "tài khoản Google"}`;
  if (row) {
    const u = await db.from("connections").update({ name, status: "connected", last_error: null, public_meta: { email: email ?? "" }, updated_at: now() }).eq("id", row.id);
    if (u.error) throw new Error(u.error.message);
    await writeSecret(row.id, stored);
    return email;
  }
  const ins = await db.from("connections").insert({ workspace_id: workspaceId, provider: "google_drive", name, status: "connected", environment: "live", created_by: userId, public_meta: { email: email ?? "" } }).select("id").single();
  if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "connection not saved");
  try { await writeSecret(ins.data.id as string, stored); } catch (e) { await db.from("connections").delete().eq("id", ins.data.id as string); throw e; }
  return email;
};

/** Forget the grant (the row and its encrypted tokens are deleted). Google-side access can still be removed in the Google account's security page. */
export const disconnectDrive = async (workspaceId: string): Promise<void> => {
  const { error } = await supabaseAdmin().from("connections").delete().eq("workspace_id", workspaceId).eq("provider", "google_drive");
  if (error) throw new Error(error.message);
};

const accessToken = async (workspaceId: string, force: boolean): Promise<string> => {
  const row = await loadRow(workspaceId);
  if (!row || row.status === "pending") throw linkError(LINK_ERROR.needGrant, "Cần cấp quyền Google Drive.");
  if (row.status === "error") throw linkError(LINK_ERROR.grantLost, "Quyền Google Drive đã bị thu hồi. Hãy cấp lại.");
  const stored = await readSecret(row.id);
  if (!stored?.refresh_token) throw linkError(LINK_ERROR.grantLost, "Quyền Google Drive đã bị thu hồi. Hãy cấp lại.");
  if (!force && stored.access_token && stored.expires_at - REFRESH_MARGIN_MS > Date.now()) return stored.access_token;
  try {
    const t = await refreshAccessToken(stored.refresh_token);
    await writeSecret(row.id, { access_token: t.accessToken, refresh_token: t.refreshToken ?? stored.refresh_token, expires_at: t.expiresAt });
    return t.accessToken;
  } catch (e) {
    if ((e as GoogleHttpError).code === "invalid_grant") {
      await supabaseAdmin().from("connections").update({ status: "error", last_error: "invalid_grant", updated_at: now() }).eq("id", row.id);
      throw linkError(LINK_ERROR.grantLost, "Quyền Google Drive đã bị thu hồi. Hãy cấp lại.");
    }
    throw e instanceof Error ? e : new Error("google_refresh_failed");
  }
};

/** Run `fn` with a valid Drive access token; one forced refresh and retry when Drive answers 401. */
export const withDriveToken = async <T>(workspaceId: string, fn: (token: string) => Promise<T>): Promise<T> => {
  const token = await accessToken(workspaceId, false);
  try {
    return await fn(token);
  } catch (e) {
    if ((e as { status?: number }).status !== 401) throw e;
    return fn(await accessToken(workspaceId, true));
  }
};
