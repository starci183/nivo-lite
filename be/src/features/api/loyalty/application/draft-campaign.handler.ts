import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyCampaignWorkbenchService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DraftCampaignResult } from "./draft-campaign.contracts"
import { DraftCampaignCommand } from "./draft-campaign.command"

@CommandHandler(DraftCampaignCommand)
/** Queues draft-campaign through the workspace-authorized campaign workbench. */
export class DraftCampaignHandler extends ICQRSHandler<DraftCampaignCommand, DraftCampaignResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly promotions: LoyaltyCampaignWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(command: DraftCampaignCommand): Promise<DraftCampaignResult> {
        return this.promotions.draft(command.params.principal.id, command.params.request)
    }
}
