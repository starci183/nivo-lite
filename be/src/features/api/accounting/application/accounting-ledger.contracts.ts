/** The workspace selected for this accounting read. */
export interface AccountingLedgerRequest {
    /** The workspace selector whose membership the service proves. */
    readonly workspaceId: string
}
