import type { DraftCampaignRequest, DraftCampaignResult } from "../../application/draft-campaign.contracts"
import type { DraftCampaignParamsRequest, DraftCampaignBodyRequest } from "./dto/draft-campaign.request"
import type { DraftCampaignResponse } from "./dto/draft-campaign.response"

/** Maps the HTTP input of draft-campaign to the command request. */
export const toDraftCampaignRequest = (
    params: DraftCampaignParamsRequest,
    body: DraftCampaignBodyRequest,
): DraftCampaignRequest => ({
    workspaceId: params.workspaceId,
    name: body.name,
    segment: {
        tiers: [...body.segment.tiers],
        inactiveDays: body.segment.inactiveDays,
        birthdayThisMonth: body.segment.birthdayThisMonth,
        minSpendVnd: body.segment.minSpendVnd,
    },
    brief: body.brief,
})

/** Maps the draft-campaign result to the HTTP answer. */
export const toDraftCampaignResponse = (result: DraftCampaignResult): DraftCampaignResponse => result
