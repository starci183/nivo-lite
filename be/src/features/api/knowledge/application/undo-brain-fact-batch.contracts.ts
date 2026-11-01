/** What the UndoBrainFactBatch operation takes. */
export interface UndoBrainFactBatchRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The batch an apply-together answered. */
    readonly batchId: string
}
