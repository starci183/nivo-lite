/**
 * OpenClaw gateway wire protocol, protocol 4 (raw WebSocket on port 18789; measured in nivo-backend docs/OPENCLAW-GATEWAY-PROTOCOL.md).
 * Frames are JSON text in three envelopes: req / res / event. There are no namespaces and it is NOT Socket.IO.
 */
export const PROTOCOL_VERSION = 4;

/**
 * client.id and client.mode are closed enums on the gateway (a wrong value closes the socket with 1008). A device-less caller is
 * cli / cli. Declared scopes are honoured ONLY on a loopback connection with a shared-secret credential, which is why the engine
 * container shares the network namespace of the openclaw container (see deploy/docker-compose.yml). From anywhere else the gateway
 * clears them to [] and every scoped call fails with missingScope.
 */
export const CLIENT_ID = "cli";
export const CLIENT_MODE = "cli";
export const SCOPES = ["operator.read", "operator.write"] as const;
export const MAX_PAYLOAD_BYTES = 26_214_400;

export type Frame =
  | { readonly type: "res"; readonly id: string; readonly ok: boolean; readonly payload: unknown; readonly error: GatewayErrorBody | null }
  | { readonly type: "event"; readonly event: string; readonly payload: unknown };

export type GatewayErrorBody = { readonly code: string; readonly message: string; readonly retryAfterMs: number | null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export const parseFrame = (raw: string): Frame | null => {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(v)) return null;
  if (v.type === "event" && typeof v.event === "string") return { type: "event", event: v.event, payload: v.payload };
  if (v.type === "res" && (typeof v.id === "string" || typeof v.id === "number")) {
    const err = isRecord(v.error) ? v.error : null;
    const details = err && isRecord(err.details) ? err.details : null;
    return {
      type: "res", id: String(v.id), ok: v.ok === true, payload: v.payload,
      error: err ? { code: typeof err.code === "string" ? err.code : "UNKNOWN", message: typeof err.message === "string" ? err.message : "", retryAfterMs: details && typeof details.retryAfterMs === "number" ? details.retryAfterMs : null } : null,
    };
  }
  return null;
};

/** The v4 connect params (additionalProperties: false on the server, so exactly these fields). The credential goes in the FIRST FRAME only. */
export const connectParams = (auth: { kind: "token"; token: string } | { kind: "password"; password: string }): Record<string, unknown> => ({
  minProtocol: PROTOCOL_VERSION,
  maxProtocol: PROTOCOL_VERSION,
  client: { id: CLIENT_ID, version: "1.0.0", platform: process.platform, mode: CLIENT_MODE },
  auth: auth.kind === "token" ? { token: auth.token } : { password: auth.password },
  role: "operator",
  scopes: [...SCOPES],
});

export type SessionMessage = { readonly sessionKey: string | null; readonly role: string | null; readonly fromOwner: boolean; readonly text: string | null };

/** Narrow a `session.message` payload: `{ sessionKey, senderIsOwner?, agentId?, message, ... }`, message being a string or an object. */
export const readSessionMessage = (payload: unknown): SessionMessage => {
  if (!isRecord(payload)) return { sessionKey: null, role: null, fromOwner: false, text: null };
  const key = typeof payload.sessionKey === "string" ? payload.sessionKey : typeof payload.key === "string" ? payload.key : null;
  const message = payload.message;
  return { sessionKey: key, role: isRecord(message) && typeof message.role === "string" ? message.role : null, fromOwner: payload.senderIsOwner === true, text: textOf(message) };
};

const textOf = (v: unknown): string | null => {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    const parts = v.map(textOf).filter((s): s is string => s !== null);
    return parts.length ? parts.join("\n") : null;
  }
  if (isRecord(v)) {
    for (const key of ["text", "content", "body"]) {
      const found = textOf(v[key]);
      if (found) return found;
    }
  }
  return null;
};
