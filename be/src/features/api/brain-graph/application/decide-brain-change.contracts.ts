/** What the DecideBrainChange operation takes: Dong y or Khong on a truth-graph change card. */
export interface DecideBrainChangeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership and role. */
    readonly workspaceId: string
    /** The change request on the card. */
    readonly changeId: string
    /** `approve` (the workspace owner only), `reject` (the owner or a manager) or `keep_both` (the owner only, near-meaning cards). */
    readonly action: "approve" | "reject" | "keep_both"
    /** The reason given with the decision. */
    readonly note?: string | undefined
}
