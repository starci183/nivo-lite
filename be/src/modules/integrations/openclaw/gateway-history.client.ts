import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import { connectParams, frameOf } from "./gateway-frame.mapper"
import type { OptionalGatewayFrame } from "./gateway-frame.mapper"
import { HISTORY_LIMIT, HISTORY_METHOD, historyOf } from "./gateway-history.mapper"
import { failureOf, requesterFor } from "./gateway.client"
import type { GatewaySocketFactory, Responder } from "./gateway.client"
import type { HistoryRequest, HistoryTurn } from "./openclaw.contracts"
import { InjectOpenclawOptions, InjectOpenclawSocketFactory } from "./openclaw.decorators"
import { OpenclawLogEvent } from "./openclaw.log-events"
import type { OpenclawOptions } from "./openclaw.options"

@Injectable()
/**
 * Reads the messages of one thread over the gateway, on a socket of its own: connect, then one history request. It sends nothing to
 * the agent and changes nothing, so a read can be repeated at will.
 */
export class GatewayHistoryClient {
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

    /** The turns of a thread, oldest first; refused when no gateway is configured, at the deadline, or when the caller aborts. */
    read(request: HistoryRequest, signal: AbortSignal): Promise<ReadonlyArray<HistoryTurn>> {
        const gateway = this.options.gateway
        if (gateway === null) return Promise.reject(new OpenclawError({ code: OpenclawErrorCode.GatewayNotConfigured }))
        return new Promise((resolve, reject) => {
            const socket = this.sockets(gateway.url)
            const pending = new Map<string, Responder>()
            const ask = requesterFor(socket, pending)
            const timeout = AbortSignal.timeout(request.timeoutMs)
            const stop = AbortSignal.any([signal, timeout])
            let settled = false
            const finish = (failure: OpenclawError | null, turns: ReadonlyArray<HistoryTurn> = []): void => {
                if (settled) return
                settled = true
                stop.removeEventListener("abort", onStop)
                socket.close()
                if (failure === null) resolve(turns)
                else reject(failure)
            }
            const onStop = (): void =>
                finish(
                    timeout.aborted
                        ? new OpenclawError({
                              code: OpenclawErrorCode.GatewayTimeout,
                              params: { timeoutMs: request.timeoutMs },
                          })
                        : new OpenclawError({ code: OpenclawErrorCode.GatewayAborted }),
                )
            const load = async (): Promise<void> => {
                await ask("connect", connectParams(gateway.auth, process.platform))
                const answer = await ask(HISTORY_METHOD, { sessionKey: request.threadKey, limit: HISTORY_LIMIT })
                finish(null, historyOf(answer, this.clock.now()))
            }
            if (stop.aborted) {
                onStop()
                return
            }
            stop.addEventListener("abort", onStop, { once: true })
            socket.onMessage((text) => {
                const frame = this.frameOfText(text)
                if (frame === null) return
                if (frame.type === "res") {
                    pending.get(frame.id)?.(frame.ok, frame.payload, frame.error)
                    pending.delete(frame.id)
                    return
                }
                if (frame.event === "connect.challenge") load().catch((cause: unknown) => finish(failureOf(cause)))
            })
            socket.onError((reason) =>
                finish(new OpenclawError({ code: OpenclawErrorCode.GatewaySocketFailed, params: { reason } })),
            )
            socket.onClose(() => finish(new OpenclawError({ code: OpenclawErrorCode.GatewayClosed })))
        })
    }

    private frameOfText(text: string): OptionalGatewayFrame {
        try {
            return frameOf(JSON.parse(text))
        } catch (cause) {
            this.logger.error(OpenclawLogEvent.FrameRejected, cause)
            return null
        }
    }
}
