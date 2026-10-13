import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DraftCampaignRequest, DraftCampaignResult } from "./draft-campaign.contracts"

/** Writes the draft of a promotion to a segment. */
export class DraftCampaignCommand extends Command<DraftCampaignResult> {
    constructor(readonly params: ExecuteParams<DraftCampaignRequest>) {
        super()
    }
}
