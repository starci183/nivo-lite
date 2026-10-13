import { QueryHandler } from "@nestjs/cqrs"
import { BookingBoardService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetBookingBoardResult } from "./get-booking-board.contracts"
import { GetBookingBoardQuery } from "./get-booking-board.query"

@QueryHandler(GetBookingBoardQuery)
/** Reads the workbench through one call to the booking domain. */
export class GetBookingBoardHandler extends ICQRSHandler<GetBookingBoardQuery, GetBookingBoardResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly boards: BookingBoardService,
    ) {
        super(logger)
    }

    protected override process(query: GetBookingBoardQuery): Promise<GetBookingBoardResult> {
        return this.boards.board(query.params.principal.id, query.params.request)
    }
}
