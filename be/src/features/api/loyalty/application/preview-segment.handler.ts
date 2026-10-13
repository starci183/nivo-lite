import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyPromotionsService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { PreviewSegmentResult } from "./preview-segment.contracts"
import { PreviewSegmentCommand } from "./preview-segment.command"

@CommandHandler(PreviewSegmentCommand)
/** Runs preview-segment through one call of the LoyaltyPromotionsService. */
export class PreviewSegmentHandler extends ICQRSHandler<PreviewSegmentCommand, PreviewSegmentResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly promotions: LoyaltyPromotionsService,
    ) {
        super(logger)
    }

    protected override process(command: PreviewSegmentCommand): Promise<PreviewSegmentResult> {
        return this.promotions.preview(command.params.principal.id, command.params.request)
    }
}
