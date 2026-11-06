import type { EntityManager } from "typeorm"

/** A customer as the steps of the journal show it: who it is and where it stands. */
export interface LeadDeskCard {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** The company, empty when unknown. */
    readonly company: string
    /** The journey stage. */
    readonly stage: string
}

/** The one door to the leads capability: the customers a step belongs to. The leads capability binds it. */
export interface LeadDesk {
    /** The cards of the given customers of the workspace (a missing customer is missing from the answer). */
    cardsOf(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<LeadDeskCard>>
    /** Holds the customer of the workspace in the caller's transaction so it cannot go away before the caller writes; false when there is none. */
    hold(workspaceId: string, leadId: string, manager: EntityManager): Promise<boolean>
}

/** An agent as the responsibilities name it: its id and its display name. */
export interface ResponsibilityAgent {
    /** The agent id. */
    readonly id: string
    /** The display name. */
    readonly name: string
}

/** The one door to the agents capability: which agent speaks for a department, and who an id names. The app root binds it. */
export interface ResponsibilityAgents {
    /** The agent of a department for the workspace (the installation's own agent when one is named, else the department's first active agent); null when there is none. */
    agentOfDepartment(
        workspaceId: string,
        department: string,
        installationId: string | null,
    ): Promise<ResponsibilityAgent | null>
    /** The agent of the workspace with this id, active or paused; null when the workspace has none. */
    agentById(workspaceId: string, agentId: string): Promise<ResponsibilityAgent | null>
}
