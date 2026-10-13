/** What the CreateKnowledgeUpload operation takes. */
export interface CreateKnowledgeUploadRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The file name. */
    readonly filename: string
}
