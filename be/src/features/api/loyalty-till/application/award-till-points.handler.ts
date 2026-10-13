import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyApiService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AwardTillPointsResult } from "./award-till-points.contracts"
import { AwardTillPointsCommand } from "./award-till-points.command"

@CommandHandler(AwardTillPointsCommand)
/** Runs award-till-points through one call of the LoyaltyApiService. */
export class AwardTillPointsHandler extends ICQRSHandler<AwardTillPointsCommand, AwardTillPointsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tillApi: LoyaltyApiService,
    ) {
        super(logger)
    }

    protected override process(command: AwardTillPointsCommand): Promise<AwardTillPointsResult> {
        return this.tillApi.award(command.params.request)
    }
}
