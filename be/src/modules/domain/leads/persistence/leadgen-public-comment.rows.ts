/** The existing captured lead flow supplies the public-comment delivery context. */
export interface LeadGenPublicCommentFlowRow {
    /** Meta connection linked to this captured prospect. */
    readonly connection_id: string | null
    /** Customer conversation linked to this captured prospect. */
    readonly conversation_id: string | null
    /** The source network of the captured prospect. */
    readonly platform: string | null
}
