import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetBookingOverviewRequest, GetBookingOverviewResult } from "./get-booking-overview.contracts"

/** Shows the figures and statistics of the calendar. */
export class GetBookingOverviewQuery extends Query<GetBookingOverviewResult> {
    constructor(readonly params: ExecuteParams<GetBookingOverviewRequest>) {
        super()
    }
}
