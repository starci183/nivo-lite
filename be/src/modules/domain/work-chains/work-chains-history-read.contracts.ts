/** A chain step as the decision history names its thread. */
export interface StepThread {
    /** The step id. */
    readonly id: string
    /** The thread the step belongs to. */
    readonly threadId: string
}

/** A hand-off or assignment a member completed, as the decision history lists it. */
export interface CompletedTask {
    /** The step id. */
    readonly id: string
    /** The thread the step belongs to. */
    readonly threadId: string
    /** member or agent. */
    readonly actorKind: string
    /** The actor id. */
    readonly actorId: string
    /** The step title. */
    readonly action: string
    /** The authority rule, or null. */
    readonly rule: string | null
    /** The member who completed it. */
    readonly decidedBy: string
    /** When it finished, else when it started. */
    readonly at: Date
}
