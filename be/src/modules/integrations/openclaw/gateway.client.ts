import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import { connectParams, looksFinal, parseFrame, readSessionMessage } from "./gateway-frame.mapper"
import type { GatewayErrorBody, MessageUsage } from "./gateway-frame.mapper"
import type { RunUsage, TurnRequest, TurnResult } from "./openclaw.contracts"
import { InjectOpenclawOptions, InjectOpenclawSocketFactory } from "./openclaw.decorators"
import { OpenclawLogEvent } from "./openclaw.log-events"
import type { OpenclawOptions } from "./openclaw.options"

/** The narrow socket surface a turn needs; the production adapter wraps the platform WebSocket, a spec scripts it. */
export interface GatewaySocket {
    /** Sends one text frame. */
    send(data: string): void
    /** Closes the socket for good. */
    close(): void
    /** Registers the receiver of text frames. */
    onMessage(listener: (data: string) => void): void
    /** Registers the receiver of socket errors. */
    onError(listener: (message: string) => void): void
    /** Registers the receiver of the close code. */
    onClose(listener: (code: number) => void): void
}

/** Opens a socket to the gateway address. */
export type GatewaySocketFactory = (url: string) => GatewaySocket

/** After the first assistant message that is not already the final answer, wait this long for a better one before using it. */
const SETTLE_MS = 3000
const CONNECT_RETRIES = 3
const RETRY_WAIT_MAX_MS = 10_000
const FINAL_STATUS: ReadonlySet<string> = new Set(["ok", "done", "completed", "final", "finished"])

type Responder = (ok: boolean, payload: unknown, error: GatewayErrorBody | null) => void

/** The gateway said it is still starting: the connect is retried after `retryAfterMs`. */
class RetryableConnect extends Error {
    constructor(
        message: string,
        readonly retryAfterMs: number,
    ) {
        super(message)
    }
}

const failureOf = (cause: unknown): OpenclawError =>
    cause instanceof OpenclawError ? cause : new OpenclawError({ code: OpenclawErrorCode.GatewaySocketFailed, cause })

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

@Injectable()
/**
 * One customer turn over the gateway. The sequence is the one the protocol document measured: connect.challenge (the server speaks
 * first), connect (the credential in the first frame), sessions.subscribe, sessions.messages.subscribe, sessions.send, then
 * session.message events. The subscribe calls are the trap: without them the socket stays healthy and no reply ever arrives. A run is
 * two-stage (an accepted ack, then streamed output), so the ack is never read as the answer.
 */
export class GatewayClient {
    /** Sessions this process already created: a conversation reuses its session. Dropped when a turn on it fails. */
    private readonly created = new Set<string>()

    constructor(
        @InjectOpenclawOptions() private readonly options: OpenclawOptions,
        @InjectOpenclawSocketFactory() private readonly sockets: GatewaySocketFactory,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** True when a gateway is configured. */
    get enabled(): boolean {
        return this.options.gateway !== null
    }

    /** Runs one turn, retrying the connect while the gateway is still starting. */
    runTurn(request: TurnRequest, signal: AbortSignal): Promise<TurnResult> {
        return this.attempt(request, signal, 1)
    }

    private attempt(request: TurnRequest, signal: AbortSignal, attempt: number): Promise<TurnResult> {
        return this.once(request, signal).catch(async (cause: unknown) => {
            if (!(cause instanceof RetryableConnect)) throw cause
            if (attempt >= CONNECT_RETRIES || signal.aborted) {
                throw new OpenclawError({
                    code: OpenclawErrorCode.GatewayRefused,
                    params: { method: "connect" },
                    cause,
                })
            }
            this.logger.warn(OpenclawLogEvent.ConnectRetry, { retryAfterMs: cause.retryAfterMs })
            await sleep(Math.min(cause.retryAfterMs, RETRY_WAIT_MAX_MS))
            return this.attempt(request, signal, attempt + 1)
        })
    }

    private once(req: TurnRequest, signal: AbortSignal): Promise<TurnResult> {
        const gateway = this.options.gateway
        if (gateway === null) {
            return Promise.reject(new OpenclawError({ code: OpenclawErrorCode.GatewayNotConfigured }))
        }
        return new Promise<TurnResult>((resolve, reject) => {
            const socket = this.sockets(gateway.url)
            const startedAt = Date.now()
            const marks: Array<[string, number]> = []
            const mark = (name: string): void => {
                marks.push([name, Date.now() - startedAt])
            }
            const used = {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                cost: 0,
                model: null as string | null,
                seen: false,
            }
            const addUsage = (usage: MessageUsage | null): void => {
                if (usage === null) return
                used.input += usage.input
                used.output += usage.output
                used.cacheRead += usage.cacheRead
                used.cacheWrite += usage.cacheWrite
                used.cost += usage.cost
                used.model = usage.model ?? used.model
                used.seen = true
            }
            const pending = new Map<string, Responder>()
            let sequence = 0
            let settled = false
            let settleTimer: NodeJS.Timeout | null = null
            let candidate: string | null = null

            const usageResult = (): RunUsage | null =>
                used.seen
                    ? {
                          prompt_tokens: used.input + used.cacheRead + used.cacheWrite,
                          completion_tokens: used.output,
                          cached_tokens: used.cacheRead,
                          cost: used.cost,
                          model: used.model,
                      }
                    : null

            const onAbort = (): void => finish(new OpenclawError({ code: OpenclawErrorCode.GatewayAborted }))
            const deadline = setTimeout(
                () =>
                    finish(
                        new OpenclawError({
                            code: OpenclawErrorCode.GatewayTimeout,
                            params: { timeoutMs: req.timeoutMs },
                        }),
                    ),
                req.timeoutMs,
            )

            const finish = (failure: Error | null, value = ""): void => {
                if (settled) return
                settled = true
                clearTimeout(deadline)
                if (settleTimer !== null) clearTimeout(settleTimer)
                signal.removeEventListener("abort", onAbort)
                if (failure !== null) this.created.delete(req.sessionKey)
                mark(failure === null ? "reply" : "failed")
                this.logger.info(OpenclawLogEvent.TurnTimed, { agentId: req.agentId, marks: Object.fromEntries(marks) })
                socket.close()
                if (failure !== null) {
                    reject(failure)
                    return
                }
                marks.push(["total", Date.now() - startedAt])
                resolve({ text: value, usage: usageResult(), timings: Object.fromEntries(marks) })
            }

            if (signal.aborted) {
                finish(new OpenclawError({ code: OpenclawErrorCode.GatewayAborted }))
                return
            }
            signal.addEventListener("abort", onAbort, { once: true })

            /** Sends a request and waits for its `res`. */
            const request = (method: string, params: Record<string, unknown>): Promise<unknown> =>
                new Promise((ok, fail) => {
                    sequence += 1
                    const id = String(sequence)
                    pending.set(id, (good, payload, error) => {
                        if (good) {
                            ok(payload)
                            return
                        }
                        fail(
                            error?.code === "UNAVAILABLE" && method === "connect"
                                ? new RetryableConnect(error.message, error.retryAfterMs ?? 1000)
                                : new OpenclawError({
                                      code: OpenclawErrorCode.GatewayRefused,
                                      params: { method, gatewayCode: error?.code ?? "error" },
                                  }),
                        )
                    })
                    socket.send(JSON.stringify({ type: "req", id, method, params }))
                })

            const startTurn = async (): Promise<void> => {
                await request("connect", connectParams(gateway.auth, process.platform))
                mark("connect")
                // sessions.send only talks into an existing session, so create it first. An existing session is fine; any other
                // refusal shows up again, with its real reason, on sessions.send below.
                if (!this.created.has(req.sessionKey)) {
                    await request("sessions.create", { key: req.sessionKey, agentId: req.agentId }).catch(
                        (cause: unknown) => {
                            this.logger.warn(OpenclawLogEvent.SessionCreateSkipped, { reason: String(cause) })
                        },
                    )
                    this.created.add(req.sessionKey)
                    mark("create")
                }
                await request("sessions.subscribe", {})
                await request("sessions.messages.subscribe", { key: req.sessionKey, agentId: req.agentId })
                mark("subscribe")
                await request("sessions.send", {
                    key: req.sessionKey,
                    agentId: req.agentId,
                    message: req.message,
                    thinking: "off",
                    attachments: [],
                    timeoutMs: req.timeoutMs,
                    idempotencyKey: req.idempotencyKey,
                })
                mark("send_ack")
            }

            socket.onMessage((data) => {
                const frame = parseFrame(data)
                if (frame === null || settled) return
                if (frame.type === "res") {
                    pending.get(frame.id)?.(frame.ok, frame.payload, frame.error)
                    pending.delete(frame.id)
                    return
                }
                if (frame.event === "connect.challenge") {
                    startTurn().catch((cause: unknown) =>
                        finish(cause instanceof RetryableConnect ? cause : failureOf(cause)),
                    )
                    return
                }
                if (frame.event === "agent") {
                    const payload = frame.payload as { status?: unknown } | null
                    const status = typeof payload?.status === "string" ? payload.status : null
                    if (status === "error") finish(new OpenclawError({ code: OpenclawErrorCode.RunFailed }))
                    else if (status !== null && FINAL_STATUS.has(status) && candidate !== null) finish(null, candidate)
                    return
                }
                if (frame.event !== "session.message") return
                const message = readSessionMessage(frame.payload)
                // Only the agent's own words in this session; the customer message echoed back is not a reply.
                if (
                    message.sessionKey !== req.sessionKey ||
                    message.fromOwner ||
                    message.role === "user" ||
                    message.role === "system" ||
                    message.text === null
                ) {
                    return
                }
                addUsage(message.usage)
                const reply: string = message.text
                candidate = reply
                const isFinal = req.isFinal ?? ((text: string) => looksFinal(text) || message.stopReason === "stop")
                if (isFinal(reply)) {
                    finish(null, reply)
                    return
                }
                if (settleTimer !== null) clearTimeout(settleTimer)
                settleTimer = setTimeout(() => finish(null, reply), SETTLE_MS)
            })
            socket.onError((message) =>
                finish(new OpenclawError({ code: OpenclawErrorCode.GatewaySocketFailed, params: { reason: message } })),
            )
            socket.onClose(() => finish(new OpenclawError({ code: OpenclawErrorCode.GatewayClosed })))
        })
    }
}
