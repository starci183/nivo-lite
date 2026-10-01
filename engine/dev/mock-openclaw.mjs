// A FAKE OpenClaw gateway for local runs: speaks the documented raw-WebSocket protocol (v4) well enough for the engine, nothing more.
//   server speaks first (connect.challenge) -> client connect (credential in the first frame, closed client enums, scopes)
//   -> sessions.subscribe -> sessions.messages.subscribe -> sessions.send (ack: accepted) -> session.message events.
// Strict on purpose: no subscribe = no session.message (the real trap), no operator.write = missingScope, wrong credential = NOT_PAIRED.
// It also behaves like a tool-using agent: it calls the engine tool bridge with the per-turn token found in the message.
// Env: MOCK_OPENCLAW_PORT (18789), MOCK_OPENCLAW_HOST (127.0.0.1), OPENCLAW_GATEWAY_TOKEN (required)
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { WebSocketServer } from "ws";

const port = Number(process.env.MOCK_OPENCLAW_PORT ?? 18789);
const host = process.env.MOCK_OPENCLAW_HOST ?? "127.0.0.1";
const token = process.env.OPENCLAW_GATEWAY_TOKEN;
if (!token) {
  console.error("[mock-openclaw] OPENCLAW_GATEWAY_TOKEN is required");
  process.exit(1);
}
const CLIENT_IDS = new Set(["cli", "gateway-client", "openclaw-control-ui", "webchat", "node-host"]);
const CLIENT_MODES = new Set(["webchat", "cli", "ui", "backend", "node", "probe", "test"]);

const log = (...a) => console.log("[mock-openclaw]", ...a);
const wss = new WebSocketServer({ port, host });
wss.on("listening", () => log(`listening on ws://${host}:${port}`));

const frame = (ws, f) => ws.readyState === 1 && ws.send(JSON.stringify(f));
const ok = (ws, id, payload) => frame(ws, { type: "res", id, ok: true, payload });
const err = (ws, id, code, message, details) => frame(ws, { type: "res", id, ok: false, error: { code, message, ...(details ? { details } : {}) } });

wss.on("connection", (ws) => {
  const conn = { connected: false, scopes: [], subscribed: false, messagesKey: null };
  frame(ws, { type: "event", event: "connect.challenge", payload: { nonce: randomUUID(), ts: Date.now() } });

  ws.on("message", async (data) => {
    let msg;
    try { msg = JSON.parse(data.toString("utf8")); } catch { return; }
    if (msg.type !== "req") return;
    const { id, method, params = {} } = msg;

    if (method === "connect") {
      const c = params.client ?? {};
      if (!CLIENT_IDS.has(c.id) || !CLIENT_MODES.has(c.mode)) return ws.close(1008, "bad client");
      if (params.minProtocol !== 4 || params.maxProtocol !== 4) return err(ws, id, "PROTOCOL_MISMATCH", "protocol 4 only");
      if (params.auth?.token !== token && params.auth?.password !== token) return err(ws, id, "NOT_PAIRED", "device identity required", { code: "DEVICE_IDENTITY_REQUIRED" });
      conn.connected = true;
      conn.scopes = Array.isArray(params.scopes) ? params.scopes : [];
      return ok(ws, id, { type: "hello-ok", protocol: 4, serverVersion: "mock", auth: { role: "operator", scopes: conn.scopes }, policy: { maxPayload: 26214400, tickIntervalMs: 30000 } });
    }
    if (!conn.connected) return ws.close(1008, "connect first");

    if (method === "sessions.subscribe") {
      if (!conn.scopes.includes("operator.read")) return err(ws, id, "FORBIDDEN", "missingScope operator.read");
      conn.subscribed = true;
      return ok(ws, id, { subscribed: true });
    }
    if (method === "sessions.messages.subscribe") {
      conn.messagesKey = params.key;
      return ok(ws, id, { subscribed: true, key: params.key });
    }
    if (method === "sessions.send") {
      if (!conn.scopes.includes("operator.write")) return err(ws, id, "FORBIDDEN", "missingScope operator.write");
      ok(ws, id, { status: "accepted", runId: randomUUID() });
      return void runAgent(ws, conn, params);
    }
    return err(ws, id, "UNKNOWN_METHOD", String(method));
  });
});

const emitMessage = (ws, conn, key, agentId, role, content) => {
  // The real gateway only broadcasts session content to subscribed connections.
  if (!conn.subscribed || conn.messagesKey !== key) return;
  frame(ws, { type: "event", event: "session.message", payload: { sessionKey: key, agentId, senderIsOwner: role === "user", message: { role, content: [{ type: "text", text: content }] }, messageId: randomUUID() } });
};

const latestCustomerMessage = (text) => text.split("[CUSTOMER LATEST MESSAGE]").pop()?.trim() ?? "";

const callTool = async (message, name, body) => {
  const base = message.match(/HTTP POST (\S+)\/tools\//)?.[1];
  const bearer = message.match(/Bearer ([A-Za-z0-9._-]+)/)?.[1];
  if (!base || !bearer) return { status: 0, body: "no tool endpoint in the message" };
  if (process.env.MOCK_TOKEN_FILE) writeFileSync(process.env.MOCK_TOKEN_FILE, bearer); // a short-lived turn token: lets the e2e prove it dies with the job
  const res = await fetch(`${base}/tools/${name}`, { method: "POST", headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.text() };
};

const runAgent = async (ws, conn, params) => {
  const { key, agentId, message } = params;
  const customer = latestCustomerMessage(String(message));
  log(`turn on ${agentId} / ${String(key).slice(-12)}: ${JSON.stringify(customer.slice(0, 60))}`);
  emitMessage(ws, conn, key, agentId, "user", String(message)); // the echo of the injected turn: must NOT be taken as a reply
  if (/mock-silent/.test(customer)) return; // never answers: the engine must time out and fall back

  // A tool-using agent: look the answer up in the (public) knowledge through the engine tool bridge.
  const found = await callTool(String(message), "knowledge.search", { query: customer.slice(0, 200) });
  log(`tool knowledge.search -> HTTP ${found.status}`);

  let reply = { reply: `Mock OpenClaw: đã nhận "${customer.slice(0, 80)}". Bên mình sẽ tư vấn chi tiết ngay ạ.`, lead: null, needs_human: false, reason: null, proposed_answer: null, order: null, payment_claim: false };
  if (/giảm giá|discount/i.test(customer)) {
    reply = { ...reply, reply: "Mock OpenClaw: mình đã chuyển yêu cầu giảm giá cho chủ cửa hàng, sẽ phản hồi bạn sớm nhé.", needs_human: true, reason: "over_authority", proposed_answer: "Mock OpenClaw đề xuất: giảm 10% cho lần đầu, áp dụng đến hết tháng." };
  }
  emitMessage(ws, conn, key, agentId, "assistant", JSON.stringify(reply));
};
