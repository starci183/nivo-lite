/** The work item of a public lead-gen comment, as the approval reads it: the fields that decide who may approve and what to report. */
export interface LeadGenCommentItem {
    /** Identity of the work item. */
    readonly id: string
    /** The department that owns the item. */
    readonly department: string
    /** The action the item proposes. */
    readonly action: string
    /** Where the item stands in its decision flow. */
    readonly status: string
    /** The staff member the item is assigned to, if any. */
    readonly assigned_staff_id: string | null
    /** The outcome once the item is done, if any. */
    readonly result: { readonly href?: string | undefined } | null
}

/** The lead a conversation became, or null when it became none. */
export type OptionalLeadId = string | null

/** The one door to the conversations: which lead a conversation of the workspace became. The app root binds it to the conversations capability, which imports leads. */
export interface LeadConversationDirectory {
    /** The lead the conversation became; null when the conversation is another workspace's, is missing or has no lead. */
    leadIdOf(workspaceId: string, conversationId: string): Promise<OptionalLeadId>
}

/** The one door to the decisions: a work item of the workspace, read for a member. The app root binds it to the decisions capability. */
export interface LeadGenCommentDecisions {
    /** One work item of the workspace; any member may read. */
    getWorkItem(principalId: string, workspaceId: string, workItemId: string): Promise<LeadGenCommentItem>
}
