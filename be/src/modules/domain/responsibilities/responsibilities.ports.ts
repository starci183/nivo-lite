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
