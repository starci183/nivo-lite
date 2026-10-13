import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyApiService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DraftTillPromoResult } from "./draft-till-promo.contracts"
import { DraftTillPromoCommand } from "./draft-till-promo.command"

@CommandHandler(DraftTillPromoCommand)
/** Runs draft-till-promo through one call of the LoyaltyApiService. */
export class DraftTillPromoHandler extends ICQRSHandler<DraftTillPromoCommand, DraftTillPromoResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tillApi: LoyaltyApiService,
    ) {
        super(logger)
    }

    protected override process(command: DraftTillPromoCommand): Promise<DraftTillPromoResult> {
        return this.tillApi.promo(command.params.request)
    }
}
