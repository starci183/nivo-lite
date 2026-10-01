import "server-only";
import type { AutomationCardView, PipelineConfig } from "./automation-shared";
import { decryptSecret, encryptSecret, randomSecret } from "./channels";
import {
  accountEmail, applySheetEvent, createOrdersSpreadsheet, exchangeCode, googleClient, isConsentFailure, refreshAccessToken, sheetUrlOf, stateKey,
  type GoogleHttpError, type SheetEventIn, type TokenSet,
} from "./google-sheets-core";
import { supabaseAdmin } from "./supabase/admin";

/**
 * The Google integration (OAuth connection + the "Ghi đơn vào Google Sheet" automation), built on plain REST (google-sheets-core.ts).
 * One Google connection per workspace (connections.provider = 'google'); its tokens are JSON {access_token, refresh_token, expires_at}
 * encrypted in connection_secrets.ciphertext. last_error on the connection carries the reason: "consent:<code>" when Google refused
 * the consent attempt (app not enabled / not a test user: the card then says NIVO has not enabled Google yet), "invalid_grant" when
 * the refresh token was revoked (the card asks to reconnect).
 *   googleCardState         the state of the Google card for the template: ready | missing | lost | unavailable, and the sheet url once created.
 *   provisionOrdersSheet    creates the spreadsheet in the shop's Drive when config.spreadsheetId is empty.
 *   runSheetOrdersEvent     called by the automation engine; appends or updates the row; throws on failure (the run is retried).
 */
export type { SheetEventIn as SheetEvent } from "./google-sheets-core";

type Stored = { access_token: string; refresh_token: string; expires_at: number };
type Row = { id: string; status: "pending" | "connected" | "error" | "disconnected"; last_error: string | null; public_meta: Record<string, string> | null; name: string };

const REFRESH_MARGIN_MS = 90_000;
const now = () => new Date().toISOString();

export const googleStateKey = (): Buffer => stateKey(process.env.CHANNEL_TOKEN_KEY);
export const googleConfigured = (): boolean => googleClient() !== null;

const loadRow = async (workspaceId: string): Promise<Row | null> => {
  const { data } = await supabaseAdmin().from("connections").select("id, status, last_error, public_meta, name").eq("workspace_id", workspaceId).eq("provider", "google").neq("status", "disconnected").order("created_at").limit(1).maybeSingle();
  return (data as Row | null) ?? null;
};

export const googleCardState = async (workspaceId: string): Promise<{ readonly state: NonNullable<AutomationCardView["google"]>; readonly sheetUrl: string | null }> => {
  if (!googleConfigured()) return { state: "unavailable", sheetUrl: null };
  const row = await loadRow(workspaceId);
  if (!row || row.status === "pending") return { state: "missing", sheetUrl: null };
  const sheetUrl = row.public_meta?.sheet_url || null;
  if (row.status === "error") return { state: row.last_error?.startsWith("consent:") ? "unavailable" : "lost", sheetUrl };
  return { state: "ready", sheetUrl };
};

/* ------------------------------------------------------------------ the connection row */

const writeSecret = async (connectionId: string, stored: Stored | Record<string, never>): Promise<void> => {
  const ciphertext = encryptSecret(JSON.stringify(stored));
  const db = supabaseAdmin();
  const upd = await db.from("connection_secrets").update({ ciphertext }).eq("connection_id", connectionId).select("connection_id");
  if (upd.error) throw new Error(upd.error.message);
  if (!upd.data?.length) {
    const ins = await db.from("connection_secrets").insert({ connection_id: connectionId, ciphertext, webhook_secret: randomSecret() });
    if (ins.error) throw new Error(ins.error.message);
  }
};

/** Store a successful consent: the one Google connection of the workspace is created or updated (re-consent), status connected. */
export const saveGoogleConnection = async (workspaceId: string, userId: string, tokens: TokenSet, email: string | null): Promise<void> => {
  const db = supabaseAdmin();
  const row = await loadRow(workspaceId);
  let refresh = tokens.refreshToken;
  if (!refresh && row) {
    try {
      const { data } = await db.from("connection_secrets").select("ciphertext").eq("connection_id", row.id).maybeSingle();
      refresh = (JSON.parse(decryptSecret((data as { ciphertext: string }).ciphertext)) as Partial<Stored>).refresh_token ?? null;
    } catch { /* no usable previous token */ }
  }
  if (!refresh) throw new Error("no_refresh_token");
  const stored: Stored = { access_token: tokens.accessToken, refresh_token: refresh, expires_at: tokens.expiresAt };
  const meta = { ...(row?.public_meta ?? {}), email: email ?? row?.public_meta?.email ?? "" };
  const name = `Google · ${email ?? "tài khoản Google"}`;
  if (row) {
    const u = await db.from("connections").update({ name, status: "connected", last_error: null, public_meta: meta, updated_at: now() }).eq("id", row.id);
    if (u.error) throw new Error(u.error.message);
    await writeSecret(row.id, stored);
    return;
  }
  const ins = await db.from("connections").insert({ workspace_id: workspaceId, provider: "google", name, status: "connected", environment: "live", created_by: userId, public_meta: meta }).select("id").single();
  if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "connection not saved");
  try {
    await writeSecret(ins.data.id as string, stored);
  } catch (e) {
    await db.from("connections").delete().eq("id", ins.data.id as string);
    throw e;
  }
};

/** Google refused the consent (access_denied, invalid_client ...): remember it so the card says NIVO has not enabled Google yet. A working connection is left alone. */
export const recordGoogleFailure = async (workspaceId: string, userId: string, code: string): Promise<void> => {
  if (!isConsentFailure(code)) return;
  const db = supabaseAdmin();
  const row = await loadRow(workspaceId);
  const last_error = `consent:${code}`;
  if (row?.status === "connected") return;
  if (row) {
    await db.from("connections").update({ status: "error", last_error, updated_at: now() }).eq("id", row.id);
    return;
  }
  const ins = await db.from("connections").insert({ workspace_id: workspaceId, provider: "google", name: "Google", status: "error", last_error, environment: "live", created_by: userId, public_meta: {} }).select("id").single();
  if (ins.error || !ins.data) return;
  try { await writeSecret(ins.data.id as string, {}); } catch { await db.from("connections").delete().eq("id", ins.data.id as string); }
};

/** Exchange a callback code and store the connection. Returns the account email. */
export const completeGoogleConnect = async (workspaceId: string, userId: string, code: string): Promise<string | null> => {
  const tokens = await exchangeCode(code);
  const email = await accountEmail(tokens);
  await saveGoogleConnection(workspaceId, userId, tokens, email);
  return email;
};

/* ------------------------------------------------------------------ tokens */

const markLost = async (connectionId: string): Promise<void> => {
  await supabaseAdmin().from("connections").update({ status: "error", last_error: "invalid_grant", updated_at: now() }).eq("id", connectionId);
};

/** A valid access token for the workspace: refreshed lazily shortly before expiry (and re-stored encrypted). Throws google_missing / google_lost. */
const accessToken = async (workspaceId: string, force = false): Promise<string> => {
  if (!googleConfigured()) throw new Error("google_unavailable");
  const row = await loadRow(workspaceId);
  if (!row || row.status === "pending") throw new Error("google_missing");
  if (row.status === "error") throw new Error(row.last_error?.startsWith("consent:") ? "google_unavailable" : "google_lost");
  const { data } = await supabaseAdmin().from("connection_secrets").select("ciphertext").eq("connection_id", row.id).maybeSingle();
  let stored: Stored;
  try {
    stored = JSON.parse(decryptSecret((data as { ciphertext: string }).ciphertext)) as Stored;
  } catch {
    throw new Error("google_lost");
  }
  if (!stored.refresh_token) throw new Error("google_lost");
  if (!force && stored.access_token && stored.expires_at - REFRESH_MARGIN_MS > Date.now()) return stored.access_token;
  try {
    const t = await refreshAccessToken(stored.refresh_token);
    await writeSecret(row.id, { access_token: t.accessToken, refresh_token: t.refreshToken ?? stored.refresh_token, expires_at: t.expiresAt });
    return t.accessToken;
  } catch (e) {
    const err = e as GoogleHttpError;
    if (err.code === "invalid_grant") {
      await markLost(row.id);
      throw new Error("google_lost");
    }
    throw e instanceof Error ? e : new Error("google_refresh_failed");
  }
};

/** Run `fn` with a token; one forced refresh and retry when Google answers 401 (the token was revoked or rotated early). */
const withToken = async <T>(workspaceId: string, fn: (token: string) => Promise<T>): Promise<T> => {
  const token = await accessToken(workspaceId);
  try {
    return await fn(token);
  } catch (e) {
    if ((e as Partial<GoogleHttpError>).status !== 401) throw e;
    return fn(await accessToken(workspaceId, true));
  }
};

/* ------------------------------------------------------------------ the automation */

export const provisionOrdersSheet = async (workspaceId: string, _userId: string, config: PipelineConfig): Promise<{ readonly spreadsheetId: string; readonly spreadsheetUrl: string }> => {
  const existing = typeof config.spreadsheetId === "string" ? config.spreadsheetId.trim() : "";
  if (existing) return { spreadsheetId: existing, spreadsheetUrl: sheetUrlOf(existing) };
  const db = supabaseAdmin();
  const { data: ws } = await db.from("workspaces").select("name").eq("id", workspaceId).maybeSingle();
  const title = `NIVO · Đơn hàng · ${(ws as { name?: string } | null)?.name ?? "NIVO"}`.slice(0, 120);
  const made = await withToken(workspaceId, (token) => createOrdersSpreadsheet(token, title));
  const row = await loadRow(workspaceId);
  if (row) await db.from("connections").update({ public_meta: { ...(row.public_meta ?? {}), sheet_id: made.spreadsheetId, sheet_url: made.spreadsheetUrl }, updated_at: now() }).eq("id", row.id);
  return made;
};

export const runSheetOrdersEvent = async (workspaceId: string, config: PipelineConfig, event: SheetEventIn): Promise<{ readonly evidence: string; readonly skipped?: boolean }> =>
  withToken(workspaceId, (token) => applySheetEvent(token, config, event));
