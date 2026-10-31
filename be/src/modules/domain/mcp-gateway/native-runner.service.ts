import { Injectable } from "@nestjs/common"
import { InjectQueueTimeout } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { refusalOf } from "./connector-call.policy"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { GatewayCaller, GatewayJson, NativeAdapter } from "./mcp-gateway.contracts"

/** What running a native adapter came to without failing: its answer, or its refusal of an expected case. */
export interface NativeRun {
    /** An answer, or a refusal the caller reads as a tool error. */
    readonly kind: "ok" | "tool_error"
    /** The answer, or `{ error: <reason> }` of a refusal. */
    readonly value: GatewayJson
}

@Injectable()
/**
 * Runs one tool of a native adapter for a caller under the connector's time limit: the adapter gets the caller (agent and
 * conversation), the deadline is the platform timer port released as soon as the adapter answers, and an expected refusal
 * (`NativeRefused`: not connected, internal only) is an answer, never a failure of the connector. Any other failure is thrown.
 */
export class NativeRunnerService {
    constructor(@InjectQueueTimeout() private readonly timeout: QueueTimeout) {}

    /** Runs the tool; refused with `MCP_GATEWAY_TIMEOUT` when the adapter outlasts `timeoutMs`. */
    async run(
        adapter: NativeAdapter,
        caller: GatewayCaller,
        tool: string,
        timeoutMs: number,
        args: GatewayJson,
    ): Promise<NativeRun> {
        const expiry = new AbortController()
        const deadline = new Promise<never>((_resolve, reject) => {
            expiry.signal.addEventListener(
                "abort",
                () => {
                    reject(new McpGatewayError({ code: McpGatewayErrorCode.Timeout, params: { tool } }))
                },
                { once: true },
            )
        })
        const cancel = this.timeout.schedule(() => {
            expiry.abort()
        }, timeoutMs)
        try {
            return await Promise.race([this.answer(adapter, caller, tool, args), deadline])
        } finally {
            cancel()
        }
    }

    /** The adapter's answer, or its refusal of an expected case read as a tool error; any other failure is thrown. */
    private async answer(adapter: NativeAdapter, caller: GatewayCaller, tool: string, args: GatewayJson): Promise<NativeRun> {
        const who = { agentId: caller.agentId, conversationId: caller.conversationId }
        try {
            return { kind: "ok", value: await adapter.invoke(caller.workspaceId, tool, args, who) }
        } catch (cause) {
            const refusal = refusalOf(cause)
            if (refusal === null) throw cause
            return { kind: "tool_error", value: refusal }
        }
    }
}
