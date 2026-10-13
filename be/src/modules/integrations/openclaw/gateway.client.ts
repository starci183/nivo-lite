import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import { connectParams, frameOf, looksFinal, readSessionMessage, statusOf } from "./gateway-frame.mapper"
import type { GatewayErrorBody, MessageUsage, OptionalGatewayFrame } from "./gateway-frame.mapper"
import type { RunTally, RunUsage, TurnRequest, TurnResult } from "./openclaw.contracts"
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
    onMessage(receiver: (data: string) => void): void
    /** Registers the receiver of socket errors. */
    onError(receiver: (message: string) => void): void
    /** Registers the receiver of the close code. */
    onClose(receiver: (code: number) => void): void
}

/** Opens a socket to the gateway address. */
export type GatewaySocketFactory = (url: string) => GatewaySocket

const CONNECT_RETRIES = 3
const RETRY_WAIT_MAX_MS = 10_000
const RETRY_WAIT_DEFAULT_MS = 1000
const FINAL_STATUS: ReadonlySet<string> = new Set(["ok", "done", "completed", "final", "finished"])

type Responder = (ok: boolean, payload: unknown, error: GatewayErrorBody | null) => void

/** The failure a request answer turns into: a deferred connect while the gateway starts, otherwise a refusal naming the method. */
const refusalOf = (method: string, error: GatewayErrorBody | null): OpenclawError => {
    if (error?.code === "UNAVAILABLE" && method === "connect") {
        return new OpenclawError({
            code: OpenclawErrorCode.GatewayDeferred,
            params: { retryAfterMs: error.retryAfterMs ?? RETRY_WAIT_DEFAULT_MS },
        })
    }
    return new OpenclawError({
        code: OpenclawErrorCode.GatewayRefused,
        params: { method, gatewayCode: error?.code ?? "error" },
    })
}

const deferredFor = (cause: unknown): number | null => {
    if (!(cause instanceof OpenclawError) || cause.code !== OpenclawErrorCode.GatewayDeferred) return null
    return Number(cause.params.retryAfterMs)
}

const failureOf = (cause: unknown): OpenclawError =>
    cause instanceof OpenclawError ? cause : new OpenclawError({ code: OpenclawErrorCode.GatewaySocketFailed, cause })

@Injectable()
/**
 * One customer turn over the gateway. The sequence is the one the protocol document measured: connect.challenge (the server speaks
 * first), connect (the credential in the first frame), sessions.subscribe, sessions.messages.subscribe, sessions.send, then
 * session.message events. The subscribe calls are the trap: without them the socket stays healthy and no reply ever arrives. A run is
 * two-stage (an accepted ack, then streamed output), so the ack is never read as the answer.
 */
export class GatewayClient {
    /** Threads this process already created: a conversation reuses its thread. Dropped when a turn on it fails. */
    private readonly created = new Set<string>()

    constructor(
        @InjectOpenclawOptions() private readonly options: OpenclawOptions,
        @InjectOpenclawSocketFactory() private readonly sockets: GatewaySocketFactory,
        @InjectClock() private readonly clock: Clock,
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
            const retryAfterMs = deferredFor(cause)
            if (retryAfterMs === null) throw cause
            if (attempt >= CONNECT_RETRIES || signal.aborted) {
                throw new OpenclawError({
                    code: OpenclawErrorCode.GatewayRefused,
                    params: { method: "connect" },
                    cause,
                })
            }
            this.logger.warn(OpenclawLogEvent.ConnectRetry, { retryAfterMs })
            await this.pause(Math.min(retryAfterMs, RETRY_WAIT_MAX_MS))
            return this.attempt(request, signal, attempt + 1)
        })
    }

    /** Waits `ms` on the platform's abort-timeout signal. */
    private pause(ms: number): Promise<void> {
        return new Promise((resolve) => {
            AbortSignal.timeout(ms).addEventListener("abort", () => resolve(), { once: true })
        })
    }

    private frameOf(raw: string): OptionalGatewayFrame {
        try {
            return frameOf(JSON.parse(raw))
        } catch (cause) {
            this.logger.error(OpenclawLogEvent.FrameRejected, cause)
            return null
        }
    }

    private once(req: TurnRequest, signal: AbortSignal): Promise<TurnResult> {
        const gateway = this.options.gateway
        if (gateway === null) {
            return Promise.reject(new OpenclawError({ code: OpenclawErrorCode.GatewayNotConfigured }))
        }
        return new Promise<TurnResult>((resolve, reject) => {
            const socket = this.sockets(gateway.url)
            const startedAt = this.clock.now().getTime()
            const marks: Array<[string, number]> = []
            const mark = (name: string): void => {
                marks.push([name, this.clock.now().getTime() - startedAt])
            }
            const used: RunTally = {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                cost: 0,
                model: null,
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
            let settleSerial = 0
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

            const timeout = AbortSignal.timeout(req.timeoutMs)
            const stop = AbortSignal.any([signal, timeout])
            const onStop = (): void =>
                finish(
                    timeout.aborted
                        ? new OpenclawError({
                              code: OpenclawErrorCode.GatewayTimeout,
                              params: { timeoutMs: req.timeoutMs },
                          })
                        : new OpenclawError({ code: OpenclawErrorCode.GatewayAborted }),
                )

            const finish = (failure: OpenclawError | null, value = ""): void => {
                if (settled) return
                settled = true
                settleSerial += 1
                stop.removeEventListener("abort", onStop)
                if (failure !== null) this.created.delete(req.threadKey)
                mark(failure === null ? "reply" : "failed")
                this.logger.info(OpenclawLogEvent.TurnTimed, { agentId: req.agentId, marks: Object.fromEntries(marks) })
                socket.close()
                if (failure !== null) {
                    reject(failure)
                    return
                }
                marks.push(["total", this.clock.now().getTime() - startedAt])
                resolve({ text: value, usage: usageResult(), timings: Object.fromEntries(marks) })
            }

            if (stop.aborted) {
                onStop()
                return
            }
            stop.addEventListener("abort", onStop, { once: true })

            /** Sends a request and waits for its `res`. */
            const request = (method: string, params: Record<string, unknown>): Promise<unknown> =>
                new Promise((ok, fail) => {
                    sequence += 1
                    const id = String(sequence)
                    pending.set(id, (good, payload, error) => (good ? ok(payload) : fail(refusalOf(method, error))))
                    socket.send(JSON.stringify({ type: "req", id, method, params }))
                })

            const startTurn = async (): Promise<void> => {
                await request("connect", connectParams(gateway.auth, process.platform))
                mark("connect")
                // sessions.send only talks into an existing session, so create it first. An existing session is fine; any other
                // refusal shows up again, with its real reason, on sessions.send below.
                if (!this.created.has(req.threadKey)) {
                    await request("sessions.create", { key: req.threadKey, agentId: req.agentId }).catch(
                        (cause: unknown) => {
                            this.logger.warn(OpenclawLogEvent.SessionCreateSkipped, { code: failureOf(cause).code })
                        },
                    )
                    this.created.add(req.threadKey)
                    mark("create")
                }
                await request("sessions.subscribe", {})
                await request("sessions.messages.subscribe", { key: req.threadKey, agentId: req.agentId })
                mark("subscribe")
                await request("sessions.send", {
                    key: req.threadKey,
                    agentId: req.agentId,
                    message: req.message,
                    thinking: "off",
                    attachments: [],
                    timeoutMs: req.timeoutMs,
                    idempotencyKey: req.idempotencyKey,
                })
                mark("send_ack")
            }

            /** After a non-final text, waits for a better one; a newer text restarts the wait. */
            const settleOn = (reply: string): void => {
                settleSerial += 1
                const serial = settleSerial
                AbortSignal.timeout(this.options.settleMs).addEventListener(
                    "abort",
                    () => {
                        if (serial === settleSerial) finish(null, reply)
                    },
                    { once: true },
                )
            }

            socket.onMessage((data) => {
                const frame = this.frameOf(data)
                if (frame === null || settled) return
                if (frame.type === "res") {
                    pending.get(frame.id)?.(frame.ok, frame.payload, frame.error)
                    pending.delete(frame.id)
                    return
                }
                if (frame.event === "connect.challenge") {
                    startTurn().catch((cause: unknown) => finish(failureOf(cause)))
                    return
                }
                if (frame.event === "agent") {
                    const status = statusOf(frame.payload)
                    if (status === "error") finish(new OpenclawError({ code: OpenclawErrorCode.RunFailed }))
                    else if (status !== null && FINAL_STATUS.has(status) && candidate !== null) finish(null, candidate)
                    return
                }
                if (frame.event !== "session.message") return
                const message = readSessionMessage(frame.payload)
                // Only the agent's own words in this thread; the customer message echoed back is not a reply.
                if (
                    message.threadKey !== req.threadKey ||
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
                if (isFinal(reply)) finish(null, reply)
                else settleOn(reply)
            })
            socket.onError((message) =>
                finish(new OpenclawError({ code: OpenclawErrorCode.GatewaySocketFailed, params: { reason: message } })),
            )
            socket.onClose(() => finish(new OpenclawError({ code: OpenclawErrorCode.GatewayClosed })))
        })
    }
}
