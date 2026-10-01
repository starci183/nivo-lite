#!/usr/bin/env node
// Google OAuth + Sheets against LOCAL MOCK servers (no network, no secrets, no database): node scripts/google-sheets-mock-e2e.mjs
// Imports src/lib/google-sheets-core.ts directly (Node type stripping; the module has no "server-only" and no local runtime imports).
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import * as core from "../src/lib/google-sheets-core.ts";

let passed = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { passed++; console.log(`  ok  ${name}`); }, (e) => { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; });

/* ---------------------------------------------------------------- mock Google */
const log = [];
const sheets = new Map();
const col = (n) => String.fromCharCode(64 + n);
const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((r) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => r(s)); });
const idToken = (email) => `x.${Buffer.from(JSON.stringify({ email })).toString("base64url")}.y`;

const oauth = createServer(async (req, res) => {
  const body = await readBody(req);
  log.push({ svc: "oauth", method: req.method, url: req.url, body });
  if (req.url === "/token") {
    const f = new URLSearchParams(body);
    if (f.get("grant_type") === "authorization_code") {
      if (f.get("code") !== "good-code") return send(res, 400, { error: "invalid_grant", error_description: "Bad code" });
      return send(res, 200, { access_token: "AT-1", refresh_token: "RT-1", expires_in: 3600, id_token: idToken("shop@example.com"), scope: "x" });
    }
    if (f.get("refresh_token") === "RT-revoked") return send(res, 400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
    return send(res, 200, { access_token: "AT-2", expires_in: 3599 });
  }
  send(res, 404, {});
});

const sheetsApi = createServer(async (req, res) => {
  const raw = await readBody(req);
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, "http://x");
  const path = decodeURIComponent(url.pathname);
  log.push({ svc: "sheets", method: req.method, path, query: url.search, auth: req.headers.authorization, body });
  if (req.headers.authorization === "Bearer AT-expired") return send(res, 401, { error: { code: 401, status: "UNAUTHENTICATED", message: "expired" } });
  if (req.method === "POST" && path === "/v4/spreadsheets") {
    const rows = body.sheets[0].data[0].rowData.map((r) => r.values.map((c) => c.userEnteredValue.stringValue ?? c.userEnteredValue.numberValue));
    sheets.set("SHEET1", { rows, leads: body.sheets[1].data[0].rowData.map((r) => r.values.map((c) => c.userEnteredValue.stringValue)) });
    return send(res, 200, { spreadsheetId: "SHEET1", spreadsheetUrl: "https://docs.google.com/spreadsheets/d/SHEET1/edit" });
  }
  const m = path.match(/^\/v4\/spreadsheets\/([^/:]+)(?::batchUpdate|\/values:batchUpdate|\/values\/(.*))?$/);
  const sh = m && sheets.get(m[1]);
  if (!sh) return send(res, 404, { error: { status: "NOT_FOUND", message: "no sheet" } });
  if (path.endsWith(":batchUpdate") && !path.includes("/values")) return send(res, 200, { replies: [{}] });
  if (path.endsWith("/values:batchUpdate")) {
    for (const d of body.data) {
      const mm = d.range.match(/^'Đơn hàng'!([A-Z])(\d+)$/);
      const r = sh.rows[Number(mm[2]) - 1];
      r[mm[1].charCodeAt(0) - 65] = d.values[0][0];
    }
    return send(res, 200, { totalUpdatedCells: body.data.length });
  }
  const range = m[2] ?? "";
  if (req.method === "GET" && range === "'Đơn hàng'!B:B") return send(res, 200, { range, values: sh.rows.map((r) => [r[1] ?? ""]) });
  const ap = range.match(/^'(.+)'!A:([A-Z]):append$/);
  if (req.method === "POST" && ap) {
    const target = ap[1] === "Đơn hàng" ? sh.rows : sh.leads;
    target.push(body.values[0]);
    return send(res, 200, { updates: { updatedRange: `'${ap[1]}'!A${target.length}:${ap[2]}${target.length}` } });
  }
  send(res, 400, { error: { status: "INVALID", message: `unhandled ${req.method} ${range}` } });
});

const listen = (s) => new Promise((r) => s.listen(0, "127.0.0.1", () => r(`http://127.0.0.1:${s.address().port}`)));
const oauthBase = await listen(oauth);
const sheetsBaseUrl = await listen(sheetsApi);

const env = {
  GOOGLE_OAUTH_CLIENT_ID: "test-client-id.apps.googleusercontent.com", GOOGLE_OAUTH_CLIENT_SECRET: "test-secret",
  NEXT_PUBLIC_SITE_URL: "https://nivo.vn", GOOGLE_OAUTH_BASE: oauthBase, GOOGLE_SHEETS_BASE: sheetsBaseUrl,
};
const channelKey = randomBytes(32).toString("base64");

console.log("OAuth");
await ok("client falls back to the Supabase Google env names, and is null when unset", () => {
  assert.equal(core.googleClient({}), null);
  assert.deepEqual(core.googleClient({ SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: "a", SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET: "b" }), { clientId: "a", clientSecret: "b" });
  assert.equal(core.buildAuthUrl("s", {}), null);
});
await ok("default hosts are Google's; GOOGLE_OAUTH_BASE replaces both", () => {
  assert.equal(core.authEndpoint({}), "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(core.tokenEndpoint({}), "https://oauth2.googleapis.com/token");
  assert.equal(core.tokenEndpoint(env), `${oauthBase}/token`);
});
const key = core.stateKey(channelKey);
const state = core.signState(key, { workspaceId: "ws-1", userId: "u-1", returnTo: "/connections" });
await ok("authorization URL carries client_id, redirect_uri, scope, offline, consent and the signed state", () => {
  const u = new URL(core.buildAuthUrl(state, { ...env, GOOGLE_OAUTH_BASE: undefined }));
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(u.searchParams.get("client_id"), env.GOOGLE_OAUTH_CLIENT_ID);
  assert.equal(u.searchParams.get("redirect_uri"), "https://nivo.vn/api/connections/google/callback");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("scope"), "https://www.googleapis.com/auth/drive.file openid email");
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("prompt"), "consent");
  assert.equal(u.searchParams.get("state"), state);
  assert.equal(core.redirectUri({}), "http://localhost:3100/api/connections/google/callback");
});
await ok("state verifies; tampering, wrong key and expiry are rejected", () => {
  const s = core.verifyState(key, state);
  assert.deepEqual({ w: s.w, u: s.u, r: s.r }, { w: "ws-1", u: "u-1", r: "/connections" });
  const [body, sig] = state.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url")), w: "ws-2" })).toString("base64url");
  assert.equal(core.verifyState(key, `${forged}.${sig}`), null);
  assert.equal(core.verifyState(core.stateKey(randomBytes(32).toString("base64")), state), null);
  assert.equal(core.verifyState(key, state, Date.now() + 11 * 60 * 1000), null);
  assert.equal(core.verifyState(key, "garbage"), null);
});
await ok("returnTo must be a same-site path", () => {
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil", "", undefined]) assert.equal(core.safeReturnTo(bad), "/connections");
  assert.equal(core.safeReturnTo("/connections?x=1"), "/connections?x=1");
  assert.equal(core.withResult("/connections?x=1", "error", "denied"), "/connections?x=1&google=error&reason=denied");
  assert.equal(core.withResult("/connections", "ok"), "/connections?google=ok");
});
await ok("code exchange against the mock returns tokens and the email from the id_token", async () => {
  const t = await core.exchangeCode("good-code", env);
  assert.equal(t.accessToken, "AT-1");
  assert.equal(t.refreshToken, "RT-1");
  assert.ok(t.expiresAt > Date.now() + 3000 * 1000);
  assert.equal(await core.accountEmail(t, env), "shop@example.com");
  const sent = new URLSearchParams(log.find((l) => l.svc === "oauth" && l.body.includes("authorization_code")).body);
  assert.equal(sent.get("redirect_uri"), "https://nivo.vn/api/connections/google/callback");
  assert.equal(sent.get("client_id"), env.GOOGLE_OAUTH_CLIENT_ID);
});
await ok("a bad code surfaces invalid_grant; a refresh works; a revoked refresh token is invalid_grant", async () => {
  await assert.rejects(core.exchangeCode("bad", env), (e) => e.code === "invalid_grant" && e.status === 400);
  const t = await core.refreshAccessToken("RT-1", env);
  assert.equal(t.accessToken, "AT-2");
  assert.equal(t.refreshToken, null);
  await assert.rejects(core.refreshAccessToken("RT-revoked", env), (e) => e.code === "invalid_grant");
});
await ok("consent failures are recognised", () => {
  for (const c of ["access_denied", "invalid_client", "org_internal"]) assert.equal(core.isConsentFailure(c), true);
  assert.equal(core.isConsentFailure("invalid_grant"), false);
});

console.log("Sheets");
const TOKEN = "AT-2";
const created = await core.createOrdersSpreadsheet(TOKEN, "NIVO · Đơn hàng · Tiệm Hoa", env, new Date("2026-10-02T03:00:00Z"));
await ok("spreadsheets.create payload: title, vi_VN, 2 tabs, header, frozen row, bold, sample row, widths", () => {
  assert.equal(created.spreadsheetId, "SHEET1");
  const req = log.find((l) => l.svc === "sheets" && l.method === "POST" && l.path === "/v4/spreadsheets");
  assert.equal(req.auth, `Bearer ${TOKEN}`);
  const b = req.body;
  assert.equal(b.properties.title, "NIVO · Đơn hàng · Tiệm Hoa");
  assert.equal(b.properties.timeZone, "Asia/Ho_Chi_Minh");
  const [orders, leads] = b.sheets;
  assert.equal(orders.properties.title, "Đơn hàng");
  assert.equal(orders.properties.gridProperties.frozenRowCount, 1);
  const hdr = orders.data[0].rowData[0].values;
  assert.deepEqual(hdr.map((c) => c.userEnteredValue.stringValue), ["Ngày", "Mã đơn", "Khách", "Dịch vụ", "Số tiền", "Trạng thái", "Đã thanh toán", "Kênh", "Người phụ trách"]);
  assert.ok(hdr.every((c) => c.userEnteredFormat.textFormat.bold === true));
  assert.equal(orders.data[0].columnMetadata.length, 9);
  const sample = orders.data[0].rowData[1].values;
  assert.equal(sample[2].userEnteredValue.stringValue, "(dòng mẫu, có thể xoá)");
  assert.equal(typeof sample[4].userEnteredValue.numberValue, "number");
  assert.equal(sample[0].userEnteredValue.stringValue, "02/10/2026 10:00");
  assert.equal(leads.properties.title, "Khách mới");
  assert.deepEqual(leads.data[0].rowData[0].values.map((c) => c.userEnteredValue.stringValue), ["Ngày", "Tên", "Công ty", "Nhu cầu", "Điện thoại", "Email", "Kênh"]);
  assert.equal(leads.properties.gridProperties.frozenRowCount, 1);
});
await ok("money column format: NUMBER with thousands separators and ' ₫'", () => {
  const req = log.find((l) => l.svc === "sheets" && l.path.endsWith(":batchUpdate"));
  const rc = req.body.requests[0].repeatCell;
  assert.equal(rc.range.startColumnIndex, 4);
  assert.equal(rc.range.endColumnIndex, 5);
  assert.equal(rc.cell.userEnteredFormat.numberFormat.type, "NUMBER");
  assert.equal(rc.cell.userEnteredFormat.numberFormat.pattern, '#,##0" ₫"');
});

const cfg = { spreadsheetId: "SHEET1", recordOrders: true, markPaid: true, recordLeads: true };
const run = (event, data, c = cfg, at = "2026-10-02T03:00:00Z") => core.applySheetEvent(TOKEN, c, { event, data, occurredAt: at }, env);
const rows = () => sheets.get("SHEET1").rows;

await ok("order.confirmed appends a row (VN time, code, customer, items, amount, status)", async () => {
  const r = await run("order.confirmed", { order_id: "o1", order_no: "DH-100", lead_id: "11111111-aaaa", customer: "Lan", items: ["Hoa hồng x2", "Giỏ"], amount_vnd: 450000, channel: "telegram", confirmed_by: "Chị Mai" });
  assert.equal(r.evidence, "Sheet SHEET1 · dòng 3 · ghi đơn DH-100");
  assert.deepEqual(rows()[2], ["02/10/2026 10:00", "DH-100", "Lan", "Hoa hồng x2, Giỏ", 450000, "Đã chốt", "", "telegram", "Chị Mai"]);
});
await ok("order.confirmed repeat does not duplicate", async () => {
  const r = await run("order.confirmed", { order_no: "DH-100", customer: "Lan", amount_vnd: 450000, lead_id: "11111111-aaaa" });
  assert.match(r.evidence, /dòng 3 · đã có dòng DH-100/);
  assert.equal(rows().length, 3);
});
await ok("payment.received updates the row found by order code; repeat is idempotent", async () => {
  const d = { order_no: "DH-100", amount_vnd: 450000, paid_at: "2026-10-02T04:30:00Z", customer: "Lan" };
  const r = await run("payment.received", d);
  assert.match(r.evidence, /dòng 3 · đánh dấu đã thanh toán DH-100/);
  assert.equal(rows()[2][5], "Đã thanh toán");
  assert.equal(rows()[2][6], "Đã thanh toán 450.000 ₫, 02/10/2026 11:30");
  const again = await run("payment.received", d);
  assert.match(again.evidence, /dòng 3/);
  assert.equal(rows().length, 3);
  const batch = log.filter((l) => l.path?.endsWith("/values:batchUpdate")).at(-1);
  assert.equal(batch.body.valueInputOption, "RAW");
});
await ok("payment.received with no row appends one already marked paid", async () => {
  const r = await run("payment.received", { order_no: "DH-200", amount_vnd: 90000, customer: "Hùng" });
  assert.match(r.evidence, /dòng 4 · thêm dòng đã thanh toán DH-200/);
  assert.equal(rows()[3][5], "Đã thanh toán");
  assert.equal(rows()[3][4], 90000);
});
await ok("deal.won appends once keyed by the lead; a later order.confirmed turns that row into the order", async () => {
  const lead = "22222222-bbbb-cccc-dddd-eeeeeeeeeeee";
  const r = await run("deal.won", { lead_id: lead, name: "Bình", company: "Công ty B", channel: "zalo", need: "Làm website" });
  assert.match(r.evidence, /dòng 5 · chốt khách KH-22222222/);
  assert.equal(rows()[4][2], "Bình");
  const again = await run("deal.won", { lead_id: lead, name: "Bình" });
  assert.match(again.evidence, /đã có dòng KH-22222222/);
  assert.equal(rows().length, 5);
  const ord = await run("order.confirmed", { order_no: "DH-300", lead_id: lead, customer: "Bình", items: "Website", amount_vnd: 9000000, confirmed_by: "Anh Nam" });
  assert.match(ord.evidence, /dòng 5 · cập nhật dòng KH-22222222 thành đơn DH-300/);
  assert.equal(rows().length, 5);
  assert.equal(rows()[4][1], "DH-300");
  assert.equal(rows()[4][4], 9000000);
});
await ok("lead.created appends to Khách mới", async () => {
  const r = await run("lead.created", { name: "Chi", company: "C", need: "Báo giá", phone: "0901", email: "c@x.vn", channel: "web" });
  assert.equal(r.evidence, "Sheet SHEET1 · dòng 2 · khách mới Chi");
  assert.deepEqual(sheets.get("SHEET1").leads[1].slice(1), ["Chi", "C", "Báo giá", "0901", "c@x.vn", "web"]);
});
await ok("toggles off skip without touching the sheet", async () => {
  const before = log.length;
  for (const [ev, c] of [["order.confirmed", { ...cfg, recordOrders: false }], ["deal.won", { ...cfg, recordOrders: false }], ["payment.received", { ...cfg, markPaid: false }], ["lead.created", { ...cfg, recordLeads: false }]]) {
    const r = await run(ev, { order_no: "X" }, c);
    assert.equal(r.skipped, true);
  }
  assert.equal(log.length, before);
});
await ok("a formula-looking customer name is written RAW, never as a formula", async () => {
  await run("order.confirmed", { order_no: "DH-400", customer: "=HYPERLINK(\"http://evil\")", amount_vnd: 1 });
  const ap = log.filter((l) => l.path?.includes(":append")).at(-1);
  assert.match(ap.query, /valueInputOption=RAW/);
});
await ok("an expired access token (401) surfaces as an error with status 401", async () => {
  await assert.rejects(core.applySheetEvent("AT-expired", cfg, { event: "lead.created", data: {}, occurredAt: "2026-10-02T03:00:00Z" }, env), (e) => e.status === 401);
});
await ok("an unknown spreadsheet throws a short error (the engine retries)", async () => {
  await assert.rejects(core.applySheetEvent(TOKEN, { ...cfg, spreadsheetId: "NOPE" }, { event: "lead.created", data: {}, occurredAt: "2026-10-02T03:00:00Z" }, env), (e) => /google_404/.test(e.message));
  await assert.rejects(core.applySheetEvent(TOKEN, { ...cfg, spreadsheetId: "" }, { event: "lead.created", data: {}, occurredAt: "2026-10-02T03:00:00Z" }, env), /sheet_missing/);
});

oauth.close();
sheetsApi.close();
console.log(process.exitCode ? `\nFAILED (${passed} passed)` : `\nall ${passed} checks passed`);
