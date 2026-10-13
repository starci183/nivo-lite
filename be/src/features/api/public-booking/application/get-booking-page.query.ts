import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GetBookingPageRequest, GetBookingPageResult } from "./get-booking-page.contracts"

/** Shows the published booking page of a slug. */
export class GetBookingPageQuery extends Query<GetBookingPageResult> {
    constructor(readonly params: PublicExecuteParams<GetBookingPageRequest>) {
        super()
    }
}
