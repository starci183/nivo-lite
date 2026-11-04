/** What the ReviewTemplateListing operation takes. */
export interface ReviewTemplateListingRequest {
    /** The listing. */
    readonly listingId: string
    /** Approve or reject. */
    readonly decision: "approve" | "reject"
    /** What the reviewer wrote. */
    readonly note: string
    /** The percent that is the creator, or null to keep the default. */
    readonly revenueSharePct: number | null
}
