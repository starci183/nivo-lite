import { argsHashOf } from "./audit-mask.policy"
import type { GatewayCallResult, GatewayCaller, GatewayJson, ToolGraphGate, ToolScope } from "./mcp-gateway.contracts"

/** The write about to run. */
export interface HeldCall {
    /** The tool. */
    readonly name: string
    /** Its scope. */
    readonly scope: ToolScope
    /** The arguments that would be sent. */
    readonly sent: GatewayJson
}

/** What the graph did to a write: the answer of the call and what the audit line says. */
export interface GraphHold {
    /** The answer of the call. */
    readonly result: GatewayCallResult
    /** The audit outcome. */
    readonly outcome: "refused" | "approval"
    /** The audit code. */
    readonly code: "graph_stop" | "graph_ask"
}

const STOPPED: GraphHold = {
    result: { ok: false, code: "not_granted", detail: "graph_stop" },
    outcome: "refused",
    code: "graph_stop",
}

const ASKED: GraphHold = {
    result: { ok: false, code: "approval_required", reason: "graph_ask" },
    outcome: "approval",
    code: "graph_ask",
}

/** What the graph of the agent holds a write for, or null when it may run. No gate bound, a read, or a call a person approved is never held. */
export const graphHoldOf = async (
    gate: ToolGraphGate | null,
    caller: GatewayCaller,
    call: HeldCall,
): Promise<GraphHold | null> => {
    if (gate === null || call.scope === "read" || caller.approvedBy !== undefined) return null
    const verdict = await gate.judge({
        workspaceId: caller.workspaceId,
        agentId: caller.agentId,
        conversationId: caller.conversationId,
        key: caller.opKey ?? caller.workItemId ?? argsHashOf(call.sent),
        name: call.name,
        turnId: caller.turnId ?? null,
    })
    if (verdict.kind === "run") return null
    return verdict.kind === "stop" ? STOPPED : ASKED
}
