import { QueryHandler } from "@nestjs/cqrs"
import { LoyaltyBoardService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { LoyaltyProgramSettings } from "./get-loyalty-program.contracts"
import { GetLoyaltyProgramQuery } from "./get-loyalty-program.query"

@QueryHandler(GetLoyaltyProgramQuery)
/** Delegates get loyalty program to the loyalty capability. */
export class GetLoyaltyProgramHandler extends ICQRSHandler<GetLoyaltyProgramQuery, LoyaltyProgramSettings> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: LoyaltyBoardService,
    ) {
        super(logger)
    }

    protected override process(action: GetLoyaltyProgramQuery): Promise<LoyaltyProgramSettings> {
        return this.service.program(action.params.principal.id, action.params.request)
    }
}
