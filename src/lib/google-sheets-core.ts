/**
 * Google OAuth + Sheets: the pure request builders, parsers and REST calls (plain fetch, no googleapis package).
 * NO "server-only" import and no local runtime imports, so scripts/google-sheets-mock-e2e.mjs can load it directly with
 * `node` (type stripping) and drive it against local mock servers. Token storage and the connection rows live in google.ts.
 * Hosts are overridable for tests: GOOGLE_OAUTH_BASE (one base replacing accounts.google.com and oauth2.googleapis.com),
 * GOOGLE_SHEETS_BASE.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file openid email";
export const STATE_TTL_MS = 10 * 60 * 1000;
export const ORDERS_TAB = "Đơn hàng";
export const LEADS_TAB = "Khách mới";
export const ORDER_HEADER = ["Ngày", "Mã đơn", "Khách", "Dịch vụ", "Số tiền", "Trạng thái", "Đã thanh toán", "Kênh", "Người phụ trách"] as const;
export const LEAD_HEADER = ["Ngày", "Tên", "Công ty", "Nhu cầu", "Điện thoại", "Email", "Kênh"] as const;
export const SAMPLE_MARK = "(dòng mẫu, có thể xoá)";
export const MONEY_PATTERN = '#,##0" ₫"';

type Env = Readonly<Record<string, string | undefined>>;
type Cell = string | number;
type Config = Readonly<Record<string, string | number | boolean>>;

/* ------------------------------------------------------------------ configuration */

export const googleClient = (env: Env = process.env): { readonly clientId: string; readonly clientSecret: string } | null => {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID || env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID || "";
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET || env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET || "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

const trim = (s: string) => s.replace(/\/+$/, "");
export const authEndpoint = (env: Env = process.env): string => (env.GOOGLE_OAUTH_BASE ? `${trim(env.GOOGLE_OAUTH_BASE)}/o/oauth2/v2/auth` : "https://accounts.google.com/o/oauth2/v2/auth");
export const tokenEndpoint = (env: Env = process.env): string => (env.GOOGLE_OAUTH_BASE ? `${trim(env.GOOGLE_OAUTH_BASE)}/token` : "https://oauth2.googleapis.com/token");
export const userinfoEndpoint = (env: Env = process.env): string => (env.GOOGLE_OAUTH_BASE ? `${trim(env.GOOGLE_OAUTH_BASE)}/userinfo` : "https://openidconnect.googleapis.com/v1/userinfo");
export const sheetsBase = (env: Env = process.env): string => trim(env.GOOGLE_SHEETS_BASE || "https://sheets.googleapis.com");

export const siteOrigin = (env: Env = process.env): string => trim(env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100");
export const redirectUri = (env: Env = process.env): string => `${siteOrigin(env)}/api/connections/google/callback`;

/** A same-site path (single leading "/"), else the default. */
export const safeReturnTo = (v: string | null | undefined): string => (typeof v === "string" && /^\/(?![/\\])/.test(v) && !/[\r\n]/.test(v) ? v : "/connections");

/** Append ?google=ok / ?google=error&reason=x to a return path, keeping its own query. */
export const withResult = (returnTo: string, result: "ok" | "error", reason?: string): string => {
  const [path, query = ""] = safeReturnTo(returnTo).split("?");
  const params = new URLSearchParams(query);
  params.set("google", result);
  if (reason) params.set("reason", reason);
  else params.delete("reason");
  return `${path}?${params.toString()}`;
};

/* ------------------------------------------------------------------ signed state */

export type OAuthState = { readonly w: string; readonly u: string; readonly r: string; readonly e: number };
const b64u = (b: Buffer): string => b.toString("base64url");

/** The state-signing key: derived from the channel key, never the channel key itself. */
export const stateKey = (channelKeyBase64: string | undefined): Buffer => {
  const raw = channelKeyBase64 ? Buffer.from(channelKeyBase64, "base64") : Buffer.alloc(0);
  if (raw.length !== 32) throw new Error("CHANNEL_TOKEN_KEY must be 32 bytes, base64");
  return createHmac("sha256", raw).update("nivo:google-oauth-state:v1").digest();
};

export const signState = (key: Buffer, s: { workspaceId: string; userId: string; returnTo: string }, now = Date.now()): string => {
  const body = b64u(Buffer.from(JSON.stringify({ w: s.workspaceId, u: s.userId, r: safeReturnTo(s.returnTo), e: now + STATE_TTL_MS } satisfies OAuthState)));
  return `${body}.${b64u(createHmac("sha256", key).update(body).digest())}`;
};

/** The state when the signature is valid and it has not expired; otherwise null. */
export const verifyState = (key: Buffer, value: string | null | undefined, now = Date.now()): OAuthState | null => {
  if (!value) return null;
  const [body, sig, extra] = value.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expect = createHmac("sha256", key).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expect.length || !timingSafeEqual(given, expect)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (typeof s.w !== "string" || typeof s.u !== "string" || typeof s.r !== "string" || typeof s.e !== "number" || s.e < now) return null;
    return { ...s, r: safeReturnTo(s.r) };
  } catch {
    return null;
  }
};

export const buildAuthUrl = (state: string, env: Env = process.env): string | null => {
  const client = googleClient(env);
  if (!client) return null;
  const u = new URL(authEndpoint(env));
  u.searchParams.set("client_id", client.clientId);
  u.searchParams.set("redirect_uri", redirectUri(env));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GOOGLE_SCOPE);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return u.toString();
};

/* ------------------------------------------------------------------ HTTP */

export type GoogleHttpError = Error & { status: number; code: string };
const httpError = (status: number, code: string, message: string): GoogleHttpError =>
  Object.assign(new Error(`google_${status}${code ? `:${code}` : ""} ${message}`.slice(0, 200)), { status, code });

type Json = Record<string, unknown>;
const call = async (url: string, init: RequestInit): Promise<Json> => {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    throw httpError(0, "network", e instanceof Error ? e.message : "fetch failed");
  }
  const text = await res.text();
  let json: Json = {};
  try { json = text ? (JSON.parse(text) as Json) : {}; } catch { /* non-JSON body */ }
  if (!res.ok) {
    const err = json.error;
    const code = typeof err === "string" ? err : typeof (err as Json | undefined)?.status === "string" ? String((err as Json).status) : "";
    const msg = typeof json.error_description === "string" ? json.error_description : typeof (err as Json | undefined)?.message === "string" ? String((err as Json).message) : text.slice(0, 80);
    throw httpError(res.status, code, msg);
  }
  return json;
};

export type TokenSet = { readonly accessToken: string; readonly refreshToken: string | null; readonly expiresAt: number; readonly idToken: string | null };

const tokenCall = async (form: Record<string, string>, env: Env): Promise<TokenSet> => {
  const j = await call(tokenEndpoint(env), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() });
  if (typeof j.access_token !== "string") throw httpError(502, "no_token", "no access token in the response");
  return {
    accessToken: j.access_token,
    refreshToken: typeof j.refresh_token === "string" ? j.refresh_token : null,
    expiresAt: Date.now() + (typeof j.expires_in === "number" ? j.expires_in : 3600) * 1000,
    idToken: typeof j.id_token === "string" ? j.id_token : null,
  };
};

export const exchangeCode = async (code: string, env: Env = process.env): Promise<TokenSet> => {
  const c = googleClient(env);
  if (!c) throw httpError(400, "invalid_client", "client not configured");
  return tokenCall({ code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: redirectUri(env), grant_type: "authorization_code" }, env);
};

export const refreshAccessToken = async (refreshToken: string, env: Env = process.env): Promise<TokenSet> => {
  const c = googleClient(env);
  if (!c) throw httpError(400, "invalid_client", "client not configured");
  return tokenCall({ refresh_token: refreshToken, client_id: c.clientId, client_secret: c.clientSecret, grant_type: "refresh_token" }, env);
};

/** The account email: from the id_token payload (received directly from Google over TLS), else the userinfo endpoint. */
export const accountEmail = async (t: Pick<TokenSet, "idToken" | "accessToken">, env: Env = process.env): Promise<string | null> => {
  if (t.idToken) {
    try {
      const payload = JSON.parse(Buffer.from(t.idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: string };
      if (typeof payload.email === "string" && payload.email) return payload.email;
    } catch { /* fall through to userinfo */ }
  }
  try {
    const j = await call(userinfoEndpoint(env), { headers: { Authorization: `Bearer ${t.accessToken}` } });
    return typeof j.email === "string" && j.email ? j.email : null;
  } catch {
    return null;
  }
};

/** The reasons Google gives when the app is not usable for this person (not enabled, not a test user, wrong client). */
export const isConsentFailure = (code: string): boolean => /^(access_denied|invalid_client|unauthorized_client|admin_policy_enforced|org_internal|disallowed_useragent|invalid_scope)$/.test(code);

/* ------------------------------------------------------------------ Sheets requests */

const authed = (token: string, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra });
const a1 = (tab: string, range: string): string => encodeURIComponent(`'${tab}'!${range}`);

const textCell = (v: string, bold = false) => ({ userEnteredValue: { stringValue: v }, ...(bold ? { userEnteredFormat: { textFormat: { bold: true } } } : {}) });
const valueCell = (v: Cell) => (typeof v === "number" ? { userEnteredValue: { numberValue: v } } : textCell(v));

/** The body of spreadsheets.create: two tabs, bold frozen header rows, column widths and the sample row. */
export const buildCreateBody = (title: string, now: Date = new Date()) => {
  const sample: Array<Cell> = [formatVnTime(now.toISOString()), "MAU-001", SAMPLE_MARK, "Gói tư vấn", 500000, "Đã chốt", "", "Telegram", "Chủ shop"];
  const sizes = (px: ReadonlyArray<number>) => px.map((pixelSize) => ({ pixelSize }));
  return {
    properties: { title, locale: "vi_VN", timeZone: "Asia/Ho_Chi_Minh" },
    sheets: [
      {
        properties: { sheetId: 0, title: ORDERS_TAB, index: 0, gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: ORDER_HEADER.length } },
        data: [{ startRow: 0, startColumn: 0, columnMetadata: sizes([130, 110, 190, 220, 120, 130, 230, 100, 150]), rowData: [{ values: ORDER_HEADER.map((h) => textCell(h, true)) }, { values: sample.map(valueCell) }] }],
      },
      {
        properties: { sheetId: 1, title: LEADS_TAB, index: 1, gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: LEAD_HEADER.length } },
        data: [{ startRow: 0, startColumn: 0, columnMetadata: sizes([130, 170, 170, 260, 130, 200, 100]), rowData: [{ values: LEAD_HEADER.map((h) => textCell(h, true)) }] }],
      },
    ],
  };
};

/** The follow-up batchUpdate: the money column (E) shows thousands separators and " ₫" for every row below the header. */
export const buildFormatBody = () => ({
  requests: [{
    repeatCell: {
      range: { sheetId: 0, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
      cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: MONEY_PATTERN }, horizontalAlignment: "RIGHT" } },
      fields: "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment",
    },
  }],
});

export const createOrdersSpreadsheet = async (token: string, title: string, env: Env = process.env, now: Date = new Date()): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const base = sheetsBase(env);
  const j = await call(`${base}/v4/spreadsheets`, { method: "POST", headers: authed(token), body: JSON.stringify(buildCreateBody(title, now)) });
  const id = typeof j.spreadsheetId === "string" ? j.spreadsheetId : "";
  if (!id) throw httpError(502, "no_id", "spreadsheet id missing");
  await call(`${base}/v4/spreadsheets/${encodeURIComponent(id)}:batchUpdate`, { method: "POST", headers: authed(token), body: JSON.stringify(buildFormatBody()) });
  return { spreadsheetId: id, spreadsheetUrl: typeof j.spreadsheetUrl === "string" ? j.spreadsheetUrl : `https://docs.google.com/spreadsheets/d/${id}/edit` };
};

export const sheetUrlOf = (id: string): string => `https://docs.google.com/spreadsheets/d/${id}/edit`;

/** The 1-based row (and its code) of the first column-B cell equal to one of `codes` in priority order (header excluded), or null. */
export const findRow = async (token: string, id: string, codes: ReadonlyArray<string>, env: Env = process.env): Promise<{ row: number; code: string } | null> => {
  const wanted = codes.map((c) => c.trim()).filter(Boolean);
  if (!wanted.length) return null;
  const j = await call(`${sheetsBase(env)}/v4/spreadsheets/${encodeURIComponent(id)}/values/${a1(ORDERS_TAB, "B:B")}`, { headers: authed(token) });
  const rows = (Array.isArray(j.values) ? j.values : []) as Array<Array<unknown>>;
  for (const code of wanted) {
    const at = rows.findIndex((r, i) => i > 0 && String(r?.[0] ?? "").trim() === code);
    if (at >= 0) return { row: at + 1, code };
  }
  return null;
};

/** Append one row to a tab (RAW: a customer's text starting with "=" is never a formula). Returns the 1-based row it landed on. */
export const appendRow = async (token: string, id: string, tab: string, width: number, row: ReadonlyArray<Cell>, env: Env = process.env): Promise<number> => {
  const lastCol = String.fromCharCode(64 + width);
  const url = `${sheetsBase(env)}/v4/spreadsheets/${encodeURIComponent(id)}/values/${a1(tab, `A:${lastCol}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const j = await call(url, { method: "POST", headers: authed(token), body: JSON.stringify({ majorDimension: "ROWS", values: [row] }) });
  const range = String((j.updates as Json | undefined)?.updatedRange ?? "");
  const m = range.match(/!?[A-Z]+(\d+)(?::[A-Z]+\d+)?$/);
  return m ? Number(m[1]) : 0;
};

/** Update the given cells of one row (RAW). `cells` maps a column letter to its value. */
export const updateCells = async (token: string, id: string, row: number, cells: Readonly<Record<string, Cell>>, env: Env = process.env): Promise<void> => {
  const data = Object.entries(cells).map(([col, v]) => ({ range: `'${ORDERS_TAB}'!${col}${row}`, majorDimension: "ROWS", values: [[v]] }));
  await call(`${sheetsBase(env)}/v4/spreadsheets/${encodeURIComponent(id)}/values:batchUpdate`, { method: "POST", headers: authed(token), body: JSON.stringify({ valueInputOption: "RAW", data }) });
};

/* ------------------------------------------------------------------ events */

export type SheetEventName = "order.confirmed" | "deal.won" | "payment.received" | "lead.created";
export type SheetEventIn = { readonly event: SheetEventName; readonly data: Readonly<Record<string, unknown>>; readonly occurredAt: string };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const items = (v: unknown): string => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : str((x as Json | null)?.name ?? (x as Json | null)?.title))).filter(Boolean).join(", ") : str(v));

/** dd/MM/yyyy HH:mm in Vietnam time. */
export const formatVnTime = (iso: string): string => {
  const d = new Date(iso);
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};

export const formatVnd = (n: number): string => `${new Intl.NumberFormat("vi-VN").format(Math.round(n))} ₫`;

/** The code a row of a won deal carries before any order number exists. */
export const leadKey = (leadId: string): string => `KH-${leadId.replace(/-/g, "").slice(0, 8)}`;

const flag = (c: Config, k: string): boolean => c[k] === true || c[k] === "true";
const skipped = (why: string) => ({ evidence: `Bỏ qua · ${why}`, skipped: true as const });

/**
 * Apply one NIVO event to the shop's sheet using an access token. Idempotent: an order code appears once (a repeat updates or is a no-op).
 * Throws on any API failure (the caller's engine retries).
 */
export const applySheetEvent = async (token: string, config: Config, ev: SheetEventIn, env: Env = process.env): Promise<{ evidence: string; skipped?: true }> => {
  const id = str(config.spreadsheetId);
  if (!id) throw new Error("sheet_missing");
  const d = ev.data;
  const at = formatVnTime(ev.occurredAt);
  const tag = (row: number, what: string) => `Sheet ${id} · dòng ${row} · ${what}`;

  if (ev.event === "lead.created") {
    if (!flag(config, "recordLeads")) return skipped("ghi khách mới đang tắt");
    const row = await appendRow(token, id, LEADS_TAB, LEAD_HEADER.length, [at, str(d.name), str(d.company), str(d.need), str(d.phone), str(d.email), str(d.channel)], env);
    return { evidence: tag(row, `khách mới ${str(d.name) || "(không tên)"}`) };
  }

  if (ev.event === "payment.received") {
    if (!flag(config, "markPaid")) return skipped("đánh dấu đã thanh toán đang tắt");
    const orderNo = str(d.order_no);
    const lk = str(d.lead_id) ? leadKey(str(d.lead_id)) : "";
    const amount = num(d.amount_vnd);
    const paidText = `Đã thanh toán ${formatVnd(amount)}, ${formatVnTime(str(d.paid_at) || ev.occurredAt)}`;
    const row = await findRow(token, id, [orderNo, lk], env);
    if (row) {
      await updateCells(token, id, row.row, { F: "Đã thanh toán", G: paidText }, env);
      return { evidence: tag(row.row, `đánh dấu đã thanh toán ${row.code}`) };
    }
    const code = orderNo || str(d.invoice_no) || lk;
    const added = await appendRow(token, id, ORDERS_TAB, ORDER_HEADER.length, [at, code, str(d.customer), "", amount, "Đã thanh toán", paidText, "", ""], env);
    return { evidence: tag(added, `thêm dòng đã thanh toán ${code}`) };
  }

  // order.confirmed | deal.won
  if (!flag(config, "recordOrders")) return skipped("ghi đơn đang tắt");
  const orderNo = str(d.order_no);
  const lk = str(d.lead_id) ? leadKey(str(d.lead_id)) : "";
  const code = orderNo || lk;
  if (ev.event === "deal.won") {
    const have = await findRow(token, id, [orderNo, lk], env);
    if (have) return { evidence: tag(have.row, `đã có dòng ${have.code}, giữ nguyên`) };
    const row = await appendRow(token, id, ORDERS_TAB, ORDER_HEADER.length, [at, code, str(d.name) || str(d.company), str(d.need), "", "Đã chốt", "", str(d.channel), ""], env);
    return { evidence: tag(row, `chốt khách ${code}`) };
  }
  const have = await findRow(token, id, [orderNo, lk], env);
  if (have) {
    // A row from deal.won (keyed by the lead) becomes the order's row; a row that already has the order code is left as it is.
    if (!orderNo || have.code === orderNo) return { evidence: tag(have.row, `đã có dòng ${have.code}, giữ nguyên`) };
    const cells: Record<string, Cell> = { B: orderNo, D: items(d.items), E: num(d.amount_vnd), F: "Đã chốt" };
    if (str(d.confirmed_by)) cells.I = str(d.confirmed_by);
    await updateCells(token, id, have.row, cells, env);
    return { evidence: tag(have.row, `cập nhật dòng ${have.code} thành đơn ${orderNo}`) };
  }
  const row = await appendRow(token, id, ORDERS_TAB, ORDER_HEADER.length, [at, code, str(d.customer), items(d.items), num(d.amount_vnd), "Đã chốt", "", str(d.channel), str(d.confirmed_by)], env);
  return { evidence: tag(row, `ghi đơn ${code}`) };
};
