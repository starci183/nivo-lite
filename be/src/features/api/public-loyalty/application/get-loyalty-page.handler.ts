import { QueryHandler } from "@nestjs/cqrs"
import { LoyaltyPublicService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetLoyaltyPageResult } from "./get-loyalty-page.contracts"
import { GetLoyaltyPageQuery } from "./get-loyalty-page.query"

@QueryHandler(GetLoyaltyPageQuery)
/** Runs get-loyalty-page through one call of the LoyaltyPublicService. */
export class GetLoyaltyPageHandler extends ICQRSHandler<GetLoyaltyPageQuery, GetLoyaltyPageResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publicCheck: LoyaltyPublicService,
    ) {
        super(logger)
    }

    protected override process(command: GetLoyaltyPageQuery): Promise<GetLoyaltyPageResult> {
        return this.publicCheck.page(command.params.request)
    }
}
