import { Injectable } from "@nestjs/common"
import { InjectQueueTimeout, type QueueTimeout } from "@modules/platform/queue"
import { businessRefusalOf, nativeRefusalReasonOf, refusalOf } from "./tool-call.policy"
import { ToolsError, ToolsErrorCode } from "./errors/tools.error"
import type { ToolCaller, ToolJson, NativeToolFamily, NativeCaller, ProviderPart } from "./tools.contracts"

/** What running a native adapter came to without failing: its answer, or its refusal of an expected case. */
export interface NativeRun {
    /** An answer, or a refusal the caller reads as a tool error. */
    readonly kind: "ok" | "tool_error"
    /** The answer, or `{ error: <reason> }` of a refusal. */
    readonly value: ToolJson
    /** The reason of a refusal its source classed `business`; absent for an answer and for any other refusal. */
    readonly refused?: string
    /** The typed reason of any refusal (its `reason` param, whatever its class); absent for an answer and a refusal without one. */
    readonly nativeRefusal?: string
}

@Injectable()
/**
 * Runs one tool of a native adapter for a caller under the connector's time limit: the adapter gets the caller (agent and
 * conversation), the deadline is the platform timer port released as soon as the adapter answers, and an expected refusal
 * (`NativeRefused`: not connected, internal only) is an answer, never a failure of the connector. Any other failure is thrown.
 */
export class NativeRunnerService {
    constructor(@InjectQueueTimeout() private readonly timeout: QueueTimeout) {}

    /**
     * Runs the tool; refused with `MCP_GATEWAY_TIMEOUT` when the adapter outlasts `timeoutMs`. `parts` are the parts of a tool answered
     * per provider the gateway let through, handed to the adapter as they are; absent for every other tool.
     */
    async run(
        adapter: NativeToolFamily,
        caller: ToolCaller,
        tool: string,
        timeoutMs: number,
        args: ToolJson,
        parts?: ReadonlyArray<ProviderPart>,
    ): Promise<NativeRun> {
        const expiry = new AbortController()
        const deadline = new Promise<never>((_resolve, reject) => {
            expiry.signal.addEventListener(
                "abort",
                () => {
                    reject(new ToolsError({ code: ToolsErrorCode.Timeout, params: { tool } }))
                },
                { once: true },
            )
        })
        const cancel = this.timeout.schedule(() => {
            expiry.abort()
        }, timeoutMs)
        try {
            return await Promise.race([this.answer(adapter, caller, tool, args, parts), deadline])
        } finally {
            cancel()
        }
    }

    /** The adapter's answer, or its refusal of an expected case read as a tool error; any other failure is thrown. */
    private async answer(
        adapter: NativeToolFamily,
        caller: ToolCaller,
        tool: string,
        args: ToolJson,
        parts: ReadonlyArray<ProviderPart> | undefined,
    ): Promise<NativeRun> {
        const who: NativeCaller = {
            agentId: caller.agentId,
            conversationId: caller.conversationId,
            ...(caller.opKey === undefined ? {} : { opKey: caller.opKey }),
            ...(caller.turnId === undefined ? {} : { turnId: caller.turnId }),
            ...(caller.onceBy === undefined ? {} : { onceBy: caller.onceBy }),
            ...(caller.byMember === undefined ? {} : { byMember: caller.byMember }),
            ...(caller.approvedBy === undefined ? {} : { approvedBy: caller.approvedBy }),
            ...(caller.run === undefined ? {} : { run: caller.run }),
            ...(caller.graphStep === true ? { graphStep: true as const } : {}),
            ...(caller.engine === true ? { engine: true as const } : {}),
            ...(caller.origin === undefined ? {} : { origin: caller.origin }),
            ...(caller.node === undefined ? {} : { node: caller.node }),
            ...(caller.triggerRole === undefined ? {} : { triggerRole: caller.triggerRole }),
            ...(parts === undefined ? {} : { parts }),
            ...(caller.connectionId === undefined ? {} : { connectionId: caller.connectionId }),
            ...(caller.provider === undefined ? {} : { provider: caller.provider }),
        }
        try {
            return { kind: "ok", value: await adapter.invoke(caller.workspaceId, tool, args, who) }
        } catch (cause) {
            const refusal = refusalOf(cause)
            if (refusal === null) throw cause
            const refused = businessRefusalOf(cause)
            const nativeRefusal = nativeRefusalReasonOf(cause)
            return {
                kind: "tool_error",
                value: refusal,
                ...(refused === null ? {} : { refused }),
                ...(nativeRefusal === null ? {} : { nativeRefusal }),
            }
        }
    }
}
