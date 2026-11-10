/** What the DecideBrainChange operation takes: Đồng ý or Không on a truth-graph change card. */
export interface DecideBrainChangeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership and role. */
    readonly workspaceId: string
    /** The change request on the card. */
    readonly changeId: string
    /** `approve` (the workspace owner only) or `reject` (the owner or a manager). */
    readonly action: "approve" | "reject"
    /** The reason given with the decision. */
    readonly note?: string | undefined
}
