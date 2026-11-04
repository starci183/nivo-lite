/**
 * Told when a graph node raised a work item for a claim of the customer's word, so the capability that owns claims can settle or
 * escalate the claim by that item; the app root binds it, and with none bound a claim id changes nothing beyond the item.
 */
export interface WorkRaisedHook {
    /** The work item was raised for the claim. A throw fails the raise, so the node can run again. */
    raised(workspaceId: string, claimId: string, workItemId: string): Promise<void>
}

/** A lead as the work item lists name its customer: who it is and which company. */
export interface WorkItemLeadCard {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contactName: string
    /** The company. */
    readonly company: string
}

/** The one door to the leads: the work item lists fold the customer's name into their lines. The app root binds it to the leads capability. */
export interface WorkItemsLeadDirectory {
    /** The cards of the given leads of the workspace, in no particular order (a missing id is missing from the answer). */
    cardsOf(workspaceId: string, leadIds: ReadonlyArray<string>): Promise<Array<WorkItemLeadCard>>
}
