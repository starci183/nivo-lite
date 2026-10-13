import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SubmitLoyaltyCampaignRequest, SubmitLoyaltyCampaignResult } from "./submit-loyalty-campaign.contracts"

/** Asks to send a finished loyalty draft through the approval flow. */
export class SubmitLoyaltyCampaignCommand extends Command<SubmitLoyaltyCampaignResult> {
    constructor(readonly params: ExecuteParams<SubmitLoyaltyCampaignRequest>) {
        super()
    }
}
