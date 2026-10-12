import { Module } from "@nestjs/common"
import { GetBookingOverviewHandler } from "./application/get-booking-overview.handler"
import { AddBookingHandler } from "./application/add-booking.handler"
import { MoveBookingHandler } from "./application/move-booking.handler"
import { ConfirmBookingHandler } from "./application/confirm-booking.handler"
import { CheckInBookingHandler } from "./application/check-in-booking.handler"
import { CompleteBookingHandler } from "./application/complete-booking.handler"
import { MarkNoShowHandler } from "./application/mark-no-show.handler"
import { CancelBookingHandler } from "./application/cancel-booking.handler"

@Module({
    providers: [
        GetBookingOverviewHandler,
        AddBookingHandler,
        MoveBookingHandler,
        ConfirmBookingHandler,
        CheckInBookingHandler,
        CompleteBookingHandler,
        MarkNoShowHandler,
        CancelBookingHandler,
    ],
})
/** The booking feature: the handlers of its application. */
export class BookingApiModule {}
