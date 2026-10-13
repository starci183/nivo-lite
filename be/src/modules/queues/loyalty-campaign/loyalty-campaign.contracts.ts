/** The distinct job name keeps the campaign processor separate from agent generation and synchronization. */
export const DRAFT_LOYALTY_CAMPAIGN_JOB = "loyalty.campaign.draft"

/** The prepared rows that one campaign draft job serves. */
export interface LoyaltyCampaignPayload {
    /** Tenant boundary and workspace concurrency key. */
    readonly workspaceId: string
    /** The campaign to finish. */
    readonly campaignId: string
    /** The prepared AI generation, or null to retain the safe template. */
    readonly generationId: string | null
}

/** A valid campaign delivery, or null when its fields are malformed. */
export type OptionalLoyaltyCampaignPayload = LoyaltyCampaignPayload | null

/** Drops malformed deliveries instead of using untrusted ids. */
export const loyaltyCampaignPayloadOf = (value: object): OptionalLoyaltyCampaignPayload => {
    if (!("workspaceId" in value) || typeof value.workspaceId !== "string") return null
    if (!("campaignId" in value) || typeof value.campaignId !== "string") return null
    if (!("generationId" in value) || (value.generationId !== null && typeof value.generationId !== "string"))
        return null
    return { workspaceId: value.workspaceId, campaignId: value.campaignId, generationId: value.generationId }
}
