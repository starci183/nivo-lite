/** What the RecordManualEvidence operation takes. */
export interface RecordManualEvidenceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Whole dong, greater than zero. */
    readonly amount: number
    /** The day the money arrived, yyyy-mm-dd. */
    readonly date: string
    /** What the transfer said. */
    readonly content: string
    /** A note. */
    readonly note?: string | undefined
    /** The payer. */
    readonly payer?: string | undefined
}
