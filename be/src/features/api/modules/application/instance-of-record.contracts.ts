/** What looking up the installation of a record takes. */
export interface InstanceOfRecordRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The work item, conversation, booking, lead flow or lead. */
    readonly recordId: string
}
