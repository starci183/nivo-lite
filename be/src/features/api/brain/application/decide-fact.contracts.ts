/** What decide fact takes. */
export interface DecideFactRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The fact. */
    readonly id: string
    /** apply or reject a proposal, choose it among competing values, split it into its own fact, or retire an active fact. */
    readonly action: "apply" | "reject" | "choose" | "split" | "retire"
    /** The reason given with the decision. */
    readonly note?: string
    /** The situation a split value is for. */
    readonly situation?: string
}
