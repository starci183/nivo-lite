/** What the door tells the approvals when the authority rules ask a person about an action a member started. */
export interface WorkbenchApprovalAsk {
    /** The workspace the action runs in. */
    readonly workspaceId: string
    /** The member who started the action. */
    readonly memberId: string
    /** The id of the action that waits for the approval. */
    readonly action: string
    /** The money involved, VND; null when the input names none. */
    readonly amountVnd: number | null
}

/** Opens the approval request of an action: the host implements it over the approval requests capability. */
export interface WorkbenchApprovals {
    /** Opens the request and answers its id. */
    open(ask: WorkbenchApprovalAsk): Promise<string>
}
