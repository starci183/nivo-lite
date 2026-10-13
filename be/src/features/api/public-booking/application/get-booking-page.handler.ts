import { QueryHandler } from "@nestjs/cqrs"
import { BookingPublicService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetBookingPageResult } from "./get-booking-page.contracts"
import { GetBookingPageQuery } from "./get-booking-page.query"

@QueryHandler(GetBookingPageQuery)
/** Runs get-booking-page through one call of the BookingPublicService. */
export class GetBookingPageHandler extends ICQRSHandler<GetBookingPageQuery, GetBookingPageResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publicBooking: BookingPublicService,
    ) {
        super(logger)
    }

    protected override process(command: GetBookingPageQuery): Promise<GetBookingPageResult> {
        return this.publicBooking.page(command.params.request)
    }
}
