/** What the ApprovePublicDocument operation takes. */
export interface ApprovePublicDocumentRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The public document. */
    readonly id: string
    /** The exact current content revision the approver read. */
    readonly expectedDraftRevision: number
    /** True when the owner looked at the changed sources and approves the text as it stands. */
    readonly reviewedChanges?: boolean | undefined
}
