/** A step as the executive dashboard lists it. */
export interface ResponsibilitySheet {
    /** The step id. */
    readonly id: string
    /** The customer the step belongs to. */
    readonly leadId: string
    /** What is owed. */
    readonly title: string
    /** Whether an agent or a person owns it. */
    readonly ownerKind: string
    /** The owning agent, when an agent owns it. */
    readonly ownerAgentId: string | null
    /** The owner's name. */
    readonly ownerName: string
    /** The next action. */
    readonly nextAction: string
    /** When it is due, or null. */
    readonly dueAt: Date | null
    /** The state of the step. */
    readonly status: string
    /** When the step was created. */
    readonly createdAt: Date
}

/** The customer a step belongs to. */
export interface ResponsibilityLead {
    /** The step id. */
    readonly id: string
    /** The customer the step belongs to. */
    readonly leadId: string
}
