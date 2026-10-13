/** The selected customer's journey in a caller-selected workspace. */
export interface LeadFlowRequest {
    /** The workspace the caller must belong to. */
    readonly workspaceId: string
    /** The customer whose journey is read. */
    readonly leadId: string
}
