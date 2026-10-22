/** The thread a step is recorded in, locked while the step is written. */
export interface ChainThreadRow {
    /** The thread id. */
    readonly id: string
    /** The lead the thread is about, when it is about one. */
    readonly lead_id: string | null
}

/** One step of a chain joined with the name of whoever acted. */
export interface ChainStepRow {
    /** The step id. */
    readonly id: string
    /** The place of the step in its chain. */
    readonly seq: number
    /** member or agent. */
    readonly actor_kind: string
    /** The actor id. */
    readonly actor_id: string
    /** The actor's display name, or empty when the actor is gone. */
    readonly actor_name: string
    /** The member's role or the agent's module, or empty. */
    readonly actor_role: string
    /** The step kind. */
    readonly kind: string
    /** The short title. */
    readonly action: string
    /** The line under the title. */
    readonly detail: string
    /** The authority rule, or null. */
    readonly rule: string | null
    /** The tagged party, or null. */
    readonly target: { readonly kind: string; readonly id: string } | null
    /** The approval request the step waits on, or null. */
    readonly approval_request_id: string | null
    /** The step status. */
    readonly status: string
    /** The member who decided, or null. */
    readonly decided_by: string | null
    /** Start instant as database text. */
    readonly started_at: string
    /** End instant as database text, or null. */
    readonly finished_at: string | null
}

/** The id of a row an insert answered. */
export interface InsertedIdRow {
    /** The new row id. */
    readonly id: string
}

/** The id of an active member. */
export interface MemberIdRow {
    /** The member id (workspace_members.id). */
    readonly id: string
}

/** The member that owns a workspace. */
export interface WorkspaceOwnerRow {
    /** The owner's member id (workspace_members.id). */
    readonly id: string
}

/** The display name of an actor. */
export interface ActorNameRow {
    /** The display name. */
    readonly name: string
}

/** The approval step a settlement changed, with what the evidence line needs. */
export interface SettledApprovalRow {
    /** The thread the step belongs to. */
    readonly thread_id: string
    /** The step title. */
    readonly action: string
    /** The lead of the thread, or null. */
    readonly lead_id: string | null
}
