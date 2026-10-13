/** The bounded request for the add-on packs bought this month. */
export interface ListCreditPacksBoughtRequest {
    /** The workspace selector; membership is proved by the capability. */
    readonly workspaceId: string
}
