import { QueryHandler } from "@nestjs/cqrs"
import { BookingOverviewService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetBookingOverviewResult } from "./get-booking-overview.contracts"
import { GetBookingOverviewQuery } from "./get-booking-overview.query"

@QueryHandler(GetBookingOverviewQuery)
/** Runs get-booking-overview through one call of the BookingOverviewService. */
export class GetBookingOverviewHandler extends ICQRSHandler<GetBookingOverviewQuery, GetBookingOverviewResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly figures: BookingOverviewService,
    ) {
        super(logger)
    }

    protected override process(command: GetBookingOverviewQuery): Promise<GetBookingOverviewResult> {
        return this.figures.overview(command.params.principal.id, command.params.request)
    }
}
