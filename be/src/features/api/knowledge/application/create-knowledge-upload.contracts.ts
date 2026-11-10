/** What the CreateKnowledgeUpload operation takes. */
export interface CreateKnowledgeUploadRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The file name. */
    readonly filename: string
    /** The content type the browser reports for the file; may be empty. */
    readonly contentType: string
    /** The size the browser reports for the file, in bytes; absent when it reports none. */
    readonly sizeBytes?: number | undefined
}
