/** What posting a line in the Office thread takes. */
export interface PostOfficeMessageRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The text of the line. */
    readonly body: string
}
