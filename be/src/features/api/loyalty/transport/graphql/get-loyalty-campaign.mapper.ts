import type { LoyaltyCampaignView } from "@modules/domain/loyalty-campaigns"
import type { GetLoyaltyCampaignRequest } from "../../application/get-loyalty-campaign.contracts"
import type { LoyaltyCampaignInput } from "./dto/loyalty-campaign.input"
import type { LoyaltyCampaignViewType } from "./dto/loyalty-campaign-view.type"

/** Combines a bounded campaign id with the selected workspace. */
export const toGetLoyaltyCampaignRequest = (
    workspaceId: string,
    input: LoyaltyCampaignInput,
): GetLoyaltyCampaignRequest => ({
    workspaceId,
    id: input.id,
})

/** Copies the campaign's stored status and delivery counts without an envelope. */
export const toGetLoyaltyCampaignType = (result: LoyaltyCampaignView): LoyaltyCampaignViewType => ({
    id: result.id,
    name: result.name,
    segment: { ...result.segment, tiers: [...result.segment.tiers] },
    messageDraft: result.messageDraft,
    draft: result.draft,
    status: result.status,
    workItemId: result.workItemId,
    recipients: result.recipients,
    sent: result.sent,
    queued: result.queued,
    failed: result.failed,
    skipped: result.skipped,
    draftMs: result.draftMs,
    createdBy: result.createdBy,
    createdAt: result.createdAt,
    finishedAt: result.finishedAt,
    errorCode: result.errorCode,
})
