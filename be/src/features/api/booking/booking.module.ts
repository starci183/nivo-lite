import { SaveBookingServiceHandler } from "./application/save-booking-service.handler"
import { RemoveBookingServiceHandler } from "./application/remove-booking-service.handler"
import { SaveBookingResourceHandler } from "./application/save-booking-resource.handler"
import { RemoveBookingResourceHandler } from "./application/remove-booking-resource.handler"
import { SaveBookingHoursHandler } from "./application/save-booking-hours.handler"
import { SaveBookingExceptionHandler } from "./application/save-booking-exception.handler"
import { RemoveBookingExceptionHandler } from "./application/remove-booking-exception.handler"
import { SaveBookingPolicyHandler } from "./application/save-booking-policy.handler"
import { SaveBookingPublicPageHandler } from "./application/save-booking-public-page.handler"
import { RemoveBookingWaitlistEntryHandler } from "./application/remove-booking-waitlist-entry.handler"
import { GetBookingBoardHandler } from "./application/get-booking-board.handler"
import { Module } from "@nestjs/common"
import { GetBookingOverviewHandler } from "./application/get-booking-overview.handler"
import { AddBookingHandler } from "./application/add-booking.handler"
import { MoveBookingHandler } from "./application/move-booking.handler"
import { ConfirmBookingHandler } from "./application/confirm-booking.handler"
import { CheckInBookingHandler } from "./application/check-in-booking.handler"
import { CompleteBookingHandler } from "./application/complete-booking.handler"
import { MarkNoShowHandler } from "./application/mark-no-show.handler"
import { CancelBookingHandler } from "./application/cancel-booking.handler"
import { ConfigurableModuleClass } from "./booking.module-definition"

@Module({
    providers: [
        GetBookingOverviewHandler,
        GetBookingBoardHandler,
        SaveBookingServiceHandler,
        RemoveBookingServiceHandler,
        SaveBookingResourceHandler,
        RemoveBookingResourceHandler,
        SaveBookingHoursHandler,
        SaveBookingExceptionHandler,
        RemoveBookingExceptionHandler,
        SaveBookingPolicyHandler,
        SaveBookingPublicPageHandler,
        RemoveBookingWaitlistEntryHandler,
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
export class BookingApiModule extends ConfigurableModuleClass {}
