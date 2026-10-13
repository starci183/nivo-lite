import type { DraftCampaignRequest, DraftCampaignResult } from "../../application/draft-campaign.contracts"
import type { DraftCampaignInput } from "./dto/draft-campaign.input"
import type { DraftCampaignType } from "./dto/draft-campaign.type"

/** Selects the trusted workspace header and copies the bounded input. */
export const toDraftCampaignRequest = (workspaceId: string, input: DraftCampaignInput): DraftCampaignRequest => ({
    workspaceId,
    name: input.name,
    segment: {
        tiers: [...input.segment.tiers],
        inactiveDays: input.segment.inactiveDays,
        birthdayThisMonth: input.segment.birthdayThisMonth,
        minSpendVnd: input.segment.minSpendVnd,
    },
    brief: input.brief,
})

/** Maps the queued campaign without an envelope. */
export const toDraftCampaignType = (result: DraftCampaignResult): DraftCampaignType => ({
    id: result.campaignId,
    campaignId: result.campaignId,
    status: result.status,
    recipients: result.recipients,
    draft: result.draft,
})
