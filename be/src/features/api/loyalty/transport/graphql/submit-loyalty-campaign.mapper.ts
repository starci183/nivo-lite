import type { Locale } from "@modules/platform/i18n"
import type {
    SubmitLoyaltyCampaignRequest,
    SubmitLoyaltyCampaignResult,
} from "../../application/submit-loyalty-campaign.contracts"
import type { LoyaltyCampaignInput } from "./dto/loyalty-campaign.input"
import type { SubmitLoyaltyCampaignType } from "./dto/submit-loyalty-campaign.type"

/** Maps the GraphQL input to the submit request of the workspace and language it names. */
export const toSubmitLoyaltyCampaignRequest = (
    workspaceId: string,
    locale: Locale,
    input: LoyaltyCampaignInput,
): SubmitLoyaltyCampaignRequest => ({
    workspaceId,
    locale,
    id: input.id,
})

/** Maps the submission to the GraphQL type. */
export const toSubmitLoyaltyCampaignType = (result: SubmitLoyaltyCampaignResult): SubmitLoyaltyCampaignType => ({
    campaignId: result.campaignId,
    workItemId: result.workItemId,
    status: result.status,
})
