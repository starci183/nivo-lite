import { Inject, Injectable, Logger } from "@nestjs/common";
import WebSocket from "ws";
import { OPENCLAW_OPTIONS, type OpenclawOptions } from "./openclaw.config";
import { connectParams, MAX_PAYLOAD_BYTES, parseFrame, readSessionMessage } from "./gateway.protocol";

/** The gateway is not configured, unreachable, refused us, or did not answer in time. The chat.turn handler falls back on any of these. */
export class GatewayError extends Error {}

export type TurnRequest = {
  readonly agentId: string;
  /** Full session key, `agent:<agentId>:<NIVO conversation id>`. */
  readonly sessionKey: string;
  readonly message: string;
  readonly idempotencyKey: string;
  readonly timeoutMs: number;
};

/** After the first assistant message that is not already the final JSON answer, wait this long for a better one before using it. */
const SETTLE_MS = 3000;
const CONNECT_RETRIES = 3;
const FINAL_STATUS = new Set(["ok", "done", "completed", "final", "finished"]);

/**
 * One customer turn over the gateway. The sequence is the one the protocol document measured:
 *   connect.challenge (server speaks first) -> connect (credential in the first frame) -> sessions.subscribe -> sessions.messages.subscribe
 *   -> sessions.send -> session.message events.
 * The subscribe calls are the trap: without them the socket stays healthy, heartbeats arrive, and no reply ever does.
 * A run is two-stage (accepted ack, then streamed output), so the ack is never read as the answer.
 */
@Injectable()
export class GatewayClient {
  private readonly log = new Logger(GatewayClient.name);

  constructor(@Inject(OPENCLAW_OPTIONS) private readonly options: OpenclawOptions) {}

  get enabled(): boolean {
    return this.options.gateway !== null;
  }

  async runTurn(req: TurnRequest, signal: AbortSignal): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.once(req, signal);
      } catch (e) {
        const retryAfter = e instanceof RetryableConnect ? e.retryAfterMs : null;
        if (retryAfter === null || attempt >= CONNECT_RETRIES || signal.aborted) throw e instanceof RetryableConnect ? new GatewayError(e.message) : e;
        this.log.warn(`gateway still starting; retrying connect in ${retryAfter}ms`);
        await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 10_000)));
      }
    }
  }

  private once(req: TurnRequest, signal: AbortSignal): Promise<string> {
    const gateway = this.options.gateway;
    if (!gateway) return Promise.reject(new GatewayError("OpenClaw gateway is not configured"));

    return new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(gateway.url, { maxPayload: MAX_PAYLOAD_BYTES, handshakeTimeout: 10_000 });
      let seq = 0;
      let settled = false;
      let settle: NodeJS.Timeout | null = null;
      let candidate: string | null = null;
      const pending = new Map<string, (ok: boolean, payload: unknown, error: { code: string; message: string; retryAfterMs: number | null } | null) => void>();

      const finish = (err: Error | null, value?: string): void => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        if (settle) clearTimeout(settle);
        signal.removeEventListener("abort", onAbort);
        socket.removeAllListeners();
        socket.on("error", () => undefined);
        socket.terminate();
        if (err) reject(err);
        else resolve(value ?? "");
      };
      const onAbort = (): void => finish(new GatewayError("aborted"));
      const deadline = setTimeout(() => finish(new GatewayError(`no answer from OpenClaw within ${req.timeoutMs}ms`)), req.timeoutMs);
      if (signal.aborted) return finish(new GatewayError("aborted"));
      signal.addEventListener("abort", onAbort, { once: true });

      /** Send a request and wait for its `res`. */
      const request = (method: string, params: Record<string, unknown>): Promise<unknown> =>
        new Promise((ok, fail) => {
          const id = String(++seq);
          pending.set(id, (good, payload, error) => (good ? ok(payload) : fail(error && error.code === "UNAVAILABLE" && method === "connect" ? new RetryableConnect(error.message, error.retryAfterMs ?? 1000) : new GatewayError(`${method} refused: ${error?.code ?? "error"} ${error?.message ?? ""}`.trim()))));
          socket.send(JSON.stringify({ type: "req", id, method, params }));
        });

      const startTurn = async (): Promise<void> => {
        await request("connect", connectParams(gateway.auth));
        // sessions.send only talks into an EXISTING session (OpenClaw 2026.7.1: "session not found" otherwise), so create it first. An already
        // existing session is fine; any other refusal shows up again, with its real reason, on sessions.send below.
        await request("sessions.create", { key: req.sessionKey, agentId: req.agentId }).catch((e: unknown) => this.log.debug(`sessions.create: ${e instanceof Error ? e.message : String(e)}`));
        await request("sessions.subscribe", {});
        await request("sessions.messages.subscribe", { key: req.sessionKey, agentId: req.agentId });
        await request("sessions.send", { key: req.sessionKey, agentId: req.agentId, message: req.message, thinking: "off", attachments: [], timeoutMs: req.timeoutMs, idempotencyKey: req.idempotencyKey });
      };

      socket.on("message", (data: WebSocket.RawData) => {
        const frame = parseFrame(data.toString("utf8"));
        if (!frame) return;
        if (frame.type === "res") {
          pending.get(frame.id)?.(frame.ok, frame.payload, frame.error);
          pending.delete(frame.id);
          return;
        }
        if (frame.event === "connect.challenge") {
          startTurn().catch((e: unknown) => finish(e instanceof Error ? e : new GatewayError(String(e))));
          return;
        }
        if (frame.event === "agent") {
          const status = typeof (frame.payload as { status?: unknown } | null)?.status === "string" ? String((frame.payload as { status: string }).status) : null;
          if (status === "error") finish(new GatewayError("OpenClaw run ended in error"));
          else if (status && FINAL_STATUS.has(status) && candidate !== null) finish(null, candidate);
          return;
        }
        if (frame.event !== "session.message") return;
        const m = readSessionMessage(frame.payload);
        // Only the agent's own words in THIS session; the customer message echoed back (role user / from the owner) is not a reply.
        if (m.sessionKey !== req.sessionKey || m.fromOwner || m.role === "user" || m.role === "system" || m.text === null) return;
        candidate = m.text;
        if (looksFinal(m.text)) return finish(null, m.text);
        if (settle) clearTimeout(settle);
        settle = setTimeout(() => finish(null, candidate ?? ""), SETTLE_MS);
      });
      socket.on("error", (e: Error) => finish(new GatewayError(`gateway socket error: ${e.message}`)));
      socket.on("close", (code: number) => finish(new GatewayError(`gateway closed the socket (${code}) before answering`)));
    });
  }
}

class RetryableConnect extends Error {
  constructor(message: string, readonly retryAfterMs: number) {
    super(message);
  }
}

/** The contract answer: a JSON object with a "reply". Anything else may be an interim message of a tool-using run. */
const looksFinal = (text: string): boolean => /\{[\s\S]*"reply"\s*:/.test(text);
