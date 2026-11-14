import type { WorkflowWire } from "@modules/domain/agent-graphs"

/** Whether a workflow's graph shows for its agent: hidden with the providers it waits for, or shown with the side steps it skips. */
export interface WorkflowReadinessWire {
    /** True while it is hidden. */
    readonly hidden: boolean
    /** The providers a hidden workflow waits for; empty when it shows. */
    readonly waitingFor: ReadonlyArray<string>
    /** The side steps a shown workflow skips; empty when it is hidden. */
    readonly skipped: ReadonlyArray<string>
    /** The agent's attached accounts whose provider refused the credential: the owner connects them again; informative, a shown or hidden workflow alike. */
    readonly reconnect: ReadonlyArray<{ readonly provider: string; readonly connectionId: string }>
    /**
     * Why each provider keeps a hidden workflow hidden (`not_connected` | `trigger_off` | `needs_pick` | `tool_unavailable`), with the
     * stream and its accounts for a trigger's `needs_pick` (null and empty otherwise), the trigger verb a trigger causes, and the tool
     * of a `tool_unavailable`; empty when it shows.
     */
    readonly blocked: ReadonlyArray<{
        readonly provider: string
        readonly reason: string
        readonly stream: string | null
        readonly connectionIds: ReadonlyArray<string>
        readonly verb: string | null
        readonly tool: string | null
    }>
}

/** One workflow of the agentWorkflows list, with its readiness (null where it could not be read). */
export interface WorkflowListWire extends WorkflowWire {
    /** Whether its graph shows. */
    readonly readiness: WorkflowReadinessWire | null
}
