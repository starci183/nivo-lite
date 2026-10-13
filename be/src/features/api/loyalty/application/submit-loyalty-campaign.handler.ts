import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyCampaignWorkbenchService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SubmitLoyaltyCampaignCommand } from "./submit-loyalty-campaign.command"
import type { SubmitLoyaltyCampaignResult } from "./submit-loyalty-campaign.contracts"

@CommandHandler(SubmitLoyaltyCampaignCommand)
/** Sends a finished loyalty draft through the approval flow. */
export class SubmitLoyaltyCampaignHandler extends ICQRSHandler<
    SubmitLoyaltyCampaignCommand,
    SubmitLoyaltyCampaignResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly promotions: LoyaltyCampaignWorkbenchService,
    ) {
        super(logger)
    }

    protected override process(command: SubmitLoyaltyCampaignCommand): Promise<SubmitLoyaltyCampaignResult> {
        return this.promotions.submit(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.id,
            command.params.request.locale,
        )
    }
}
