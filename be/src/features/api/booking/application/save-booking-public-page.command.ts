import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveBookingPublicPageRequest, SaveBookingPublicPageResult } from "./save-booking-public-page.contracts"

/** Dispatches save-booking-public-page for the authenticated caller. */
export class SaveBookingPublicPageCommand extends Command<SaveBookingPublicPageResult> {
    constructor(readonly params: ExecuteParams<SaveBookingPublicPageRequest>) {
        super()
    }
}
