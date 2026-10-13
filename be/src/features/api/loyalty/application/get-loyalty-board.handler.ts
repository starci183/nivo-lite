import { QueryHandler } from "@nestjs/cqrs"
import { LoyaltyBoardService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { LoyaltyBoard } from "./get-loyalty-board.contracts"
import { GetLoyaltyBoardQuery } from "./get-loyalty-board.query"

@QueryHandler(GetLoyaltyBoardQuery)
/** Delegates get loyalty board to the loyalty capability. */
export class GetLoyaltyBoardHandler extends ICQRSHandler<GetLoyaltyBoardQuery, LoyaltyBoard> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: LoyaltyBoardService,
    ) {
        super(logger)
    }

    protected override process(action: GetLoyaltyBoardQuery): Promise<LoyaltyBoard> {
        return this.service.board(action.params.principal.id, action.params.request)
    }
}
