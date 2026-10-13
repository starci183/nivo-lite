/** What buying a credit pack takes. */
export interface BuyCreditPackRequest {
    /** The workspace that pays. */
    readonly workspaceId: string
    /** The pack to buy. */
    readonly packCode: string
}
