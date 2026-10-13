import { QueryHandler } from "@nestjs/cqrs"
import { BookingPublicService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ListFreeTimesResult } from "./list-free-times.contracts"
import { ListFreeTimesQuery } from "./list-free-times.query"

@QueryHandler(ListFreeTimesQuery)
/** Runs list-free-times through one call of the BookingPublicService. */
export class ListFreeTimesHandler extends ICQRSHandler<ListFreeTimesQuery, ListFreeTimesResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publicBooking: BookingPublicService,
    ) {
        super(logger)
    }

    protected override process(command: ListFreeTimesQuery): Promise<ListFreeTimesResult> {
        return this.publicBooking.freeTimes(command.params.request)
    }
}
