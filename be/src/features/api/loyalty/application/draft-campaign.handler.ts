import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyPromotionsService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DraftCampaignResult } from "./draft-campaign.contracts"
import { DraftCampaignCommand } from "./draft-campaign.command"

@CommandHandler(DraftCampaignCommand)
/** Runs draft-campaign through one call of the LoyaltyPromotionsService. */
export class DraftCampaignHandler extends ICQRSHandler<DraftCampaignCommand, DraftCampaignResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly promotions: LoyaltyPromotionsService,
    ) {
        super(logger)
    }

    protected override process(command: DraftCampaignCommand): Promise<DraftCampaignResult> {
        return this.promotions.draft(command.params.principal.id, command.params.request)
    }
}
