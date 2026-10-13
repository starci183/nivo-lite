import { QueryHandler } from "@nestjs/cqrs"
import { LoyaltyOverviewService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetLoyaltyOverviewResult } from "./get-loyalty-overview.contracts"
import { GetLoyaltyOverviewQuery } from "./get-loyalty-overview.query"

@QueryHandler(GetLoyaltyOverviewQuery)
/** Runs get-loyalty-overview through one call of the LoyaltyOverviewService. */
export class GetLoyaltyOverviewHandler extends ICQRSHandler<GetLoyaltyOverviewQuery, GetLoyaltyOverviewResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly figures: LoyaltyOverviewService,
    ) {
        super(logger)
    }

    protected override process(command: GetLoyaltyOverviewQuery): Promise<GetLoyaltyOverviewResult> {
        return this.figures.overview(command.params.principal.id, command.params.request)
    }
}
