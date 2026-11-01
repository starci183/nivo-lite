import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder, isRecord } from "@modules/platform/primitives"
import { agentIdFor } from "./agent-id.policy"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import { ADMIN_SCOPES, connectParams, frameOf } from "./gateway-frame.mapper"
import type { OptionalGatewayFrame } from "./gateway-frame.mapper"
import { failureOf, requesterFor } from "./gateway.client"
import type { GatewaySocketFactory, Responder } from "./gateway.client"
import { InjectOpenclawOptions, InjectOpenclawSocketFactory } from "./openclaw.decorators"
import { OpenclawLogEvent } from "./openclaw.log-events"
import type { OpenclawOptions } from "./openclaw.options"

/** How long one workspace's removal may hold the socket. */
const REMOVE_TIMEOUT_MS = 60_000

/** The ids in an `agents.list` answer. */
const agentIdsOf = (payload: unknown): ReadonlyArray<string> => {
    if (!isRecord(payload) || !Array.isArray(payload.agents)) return []
    return payload.agents.flatMap((agent: unknown) =>
        isRecord(agent) && typeof agent.id === "string" ? [agent.id] : [],
    )
}

@Injectable()
/**
 * Operator maintenance over the gateway, on a socket of its own: it alone connects with operator.admin, so a turn never holds that
 * scope. `agents.delete` takes the agent out of the config, purges its session rows and moves its workspace and transcripts to the
 * gateway's trash; `nivo.purgeAgents` of the nivo-bridge plugin then removes them for good, with the directories of an agent already
 * off the config.
 */
export class GatewayAdminClient {
    constructor(
        @InjectOpenclawOptions() private readonly options: OpenclawOptions,
        @InjectOpenclawSocketFactory() private readonly sockets: GatewaySocketFactory,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** True when a gateway is configured. */
    get enabled(): boolean {
        return this.options.gateway !== null
    }

    /** Removes every agent of the workspace, registered or retired, with its sessions and files; answers the registered ids. */
    removeWorkspaceAgents(workspaceId: string): Promise<ReadonlyArray<string>> {
        const prefix = agentIdFor(workspaceId, "")
        return this.remove(prefix, (id) => id.startsWith(prefix))
    }

    /** Removes one agent, registered or not, with its sessions and files. */
    removeAgent(agentId: string): Promise<ReadonlyArray<string>> {
        return this.remove(agentId, (id) => id === agentId)
    }

    private remove(match: string, isTarget: (id: string) => boolean): Promise<ReadonlyArray<string>> {
        const gateway = this.options.gateway
        if (gateway === null) {
            return Promise.reject(new OpenclawError({ code: OpenclawErrorCode.GatewayNotConfigured }))
        }
        return new Promise((resolve, reject) => {
            const socket = this.sockets(gateway.url)
            const pending = new Map<string, Responder>()
            const request = requesterFor(socket, pending)
            const timeout = AbortSignal.timeout(REMOVE_TIMEOUT_MS)
            let settled = false
            const finish = (failure: OpenclawError | null, removed: ReadonlyArray<string> = []): void => {
                if (settled) return
                settled = true
                socket.close()
                if (failure === null) resolve(removed)
                else reject(failure)
            }
            const remove = async (): Promise<void> => {
                await request("connect", connectParams(gateway.auth, process.platform, ADMIN_SCOPES))
                const removed = agentIdsOf(await request("agents.list", {})).filter(isTarget)
                await eachInOrder(removed, (agentId) => request("agents.delete", { agentId, deleteFiles: true }))
                await request("nivo.purgeAgents", { match })
                finish(null, removed)
            }
            timeout.addEventListener(
                "abort",
                () =>
                    finish(
                        new OpenclawError({
                            code: OpenclawErrorCode.GatewayTimeout,
                            params: { timeoutMs: REMOVE_TIMEOUT_MS },
                        }),
                    ),
                { once: true },
            )
            socket.onMessage((text) => {
                const frame = this.frameOfText(text)
                if (frame === null) return
                if (frame.type === "res") {
                    pending.get(frame.id)?.(frame.ok, frame.payload, frame.error)
                    pending.delete(frame.id)
                    return
                }
                if (frame.event === "connect.challenge") {
                    remove().catch((cause: unknown) => finish(failureOf(cause)))
                }
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
