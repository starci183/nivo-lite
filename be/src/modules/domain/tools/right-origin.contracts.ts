import type { NodeStepRef } from "@modules/domain/graph-nodes"

/**
 * Where a call of a provider right comes from. `node`: a step of a workflow (the node tool door, an effect of the node host, the
 * engine's replay of an approved call). Every other kind is a road OUTSIDE every node, named so the calls on it can be counted:
 * `accounting_desk` and `document_reader` (a screen or reader calling as the first agent granted), `engine_job` (a module's declared job, the engine's own
 * caller), `adapter_reask` (a native adapter asking the rights again inside a call), `approval_card` (the words of an approval card),
 * `engine_line` (the ENGINE's own line to the customer when a step stops: one holding line per stop, sent as the agent that speaks in
 * the conversation; it names the step it is sent for, and is never the node's own call).
 * A caller that states none is `unstated`. It is a label of the audit: it allows and refuses nothing.
 */
export type RightOrigin =
    | "node"
    | "accounting_desk"
    | "document_reader"
    | "engine_job"
    | "adapter_reask"
    | "approval_card"
    | "engine_line"
    | "unstated"

/**
 * The part a run plays for the provider trigger that started it: `decider` (the one agent that decides what the event means for the
 * platform's records) or `notice` (an agent that is only told). A structured fact of the run, never read from a name or a text.
 */
export type TriggerRunRole = "decider" | "notice"

/** Where one judged call came from: the road, and the workflow step when the road is a node. */
export interface RightSeen {
    /** The road the call came by. */
    readonly origin: RightOrigin
    /** The workflow step that made it; absent on a road outside every node. */
    readonly node?: NodeStepRef | undefined
    /** The role of the provider trigger that started the run; absent for a run no provider trigger started. */
    readonly triggerRole?: TriggerRunRole | undefined
}

/** Where a judged call came from, or undefined for a call that stated nothing. */
export type OptionalRightSeen = RightSeen | undefined

/** What a caller of the gateway states about where its call came from: both members are labels of the audit and decide nothing. */
export interface CallerOrigin {
    /** The road the call came by, for the audit line and the count of calls outside a node; absent = `unstated`. */
    readonly origin?: RightOrigin | undefined
    /** The workflow step that made the call, as its run token signed it; absent for a call outside a node. */
    readonly node?: NodeStepRef | undefined
    /** The role of the provider trigger that started the run, as its run token signed it; absent for any other run. */
    readonly triggerRole?: TriggerRunRole | undefined
}
