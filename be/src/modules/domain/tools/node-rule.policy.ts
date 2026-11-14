import type { NodeStepRef } from "@modules/domain/graph-nodes"
import type { NativeCaller } from "./tools.contracts"
import type { OptionalRightSeen, RightOrigin, RightSeen, TriggerRunRole } from "./right-origin.contracts"

/**
 * A workflow step as a run token or a turn carries it, with the role of the provider trigger that started its run when the host signed
 * one, and, on the engine's own line to a customer, the agent of the RUN (`runAgentId`: the line is spoken as the agent of the
 * conversation, which may be another one; the node and its rows are the run's agent's).
 */
export type StepSeen = NodeStepRef & {
    /** The role the trigger of the run plays, when known. */
    readonly triggerRole?: unknown
    /** The agent the run belongs to, when known. */
    readonly runAgentId?: unknown
}

/** The agent of the run a step belongs to, when the step states one (the engine's own line); undefined otherwise. */
export const runAgentOf = (step: StepSeen | undefined): string | undefined =>
    typeof step?.runAgentId === "string" && step.runAgentId !== "" ? step.runAgentId : undefined

/** The role of the provider trigger that started a step's run, or undefined for a step that carries none (or anything else). */
export const triggerRoleOf = (step: StepSeen | undefined): TriggerRunRole | undefined =>
    step?.triggerRole === "decider" || step?.triggerRole === "notice" ? step.triggerRole : undefined

/** Where a call made at a workflow step came from: the road, the step, and the role of the run's provider trigger when it has one. */
export const seenAtStep = (origin: RightOrigin, step: StepSeen): RightSeen => {
    const triggerRole = triggerRoleOf(step)
    const node: NodeStepRef = { nodeKey: step.nodeKey, versionId: step.versionId, workflowId: step.workflowId }
    return { origin, node, ...(triggerRole === undefined ? {} : { triggerRole }) }
}

/**
 * Where a native adapter's own question about the accounts comes from: the road `adapter_reask` with the workflow step of the gateway call
 * it runs in, or undefined when that call stated neither a road nor a step.
 */
export const reaskSeenOf = (caller: NativeCaller): OptionalRightSeen => {
    if (caller.origin === undefined && caller.node === undefined) return undefined
    return {
        origin: "adapter_reask",
        ...(caller.node === undefined ? {} : { node: caller.node }),
        ...(caller.triggerRole === undefined ? {} : { triggerRole: caller.triggerRole }),
    }
}
