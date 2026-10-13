import { Module } from "@nestjs/common"
import { BookingApiModule } from "../../booking.module"
import { BookingBoardResolver } from "./booking-board.resolver"
import { AddBookingResolver } from "./add-booking.resolver"
import { MoveBookingResolver } from "./move-booking.resolver"
import { ConfirmBookingResolver } from "./confirm-booking.resolver"
import { CheckInBookingResolver } from "./check-in-booking.resolver"
import { CompleteBookingResolver } from "./complete-booking.resolver"
import { MarkBookingNoShowResolver } from "./mark-booking-no-show.resolver"
import { CancelBookingResolver } from "./cancel-booking.resolver"
import { SaveBookingServiceResolver } from "./save-booking-service.resolver"
import { RemoveBookingServiceResolver } from "./remove-booking-service.resolver"
import { SaveBookingResourceResolver } from "./save-booking-resource.resolver"
import { RemoveBookingResourceResolver } from "./remove-booking-resource.resolver"
import { SaveBookingHoursResolver } from "./save-booking-hours.resolver"
import { SaveBookingExceptionResolver } from "./save-booking-exception.resolver"
import { RemoveBookingExceptionResolver } from "./remove-booking-exception.resolver"
import { SaveBookingPolicyResolver } from "./save-booking-policy.resolver"
import { SaveBookingPublicPageResolver } from "./save-booking-public-page.resolver"
import { RemoveBookingWaitlistEntryResolver } from "./remove-booking-waitlist-entry.resolver"

@Module({
    imports: [BookingApiModule],
    providers: [
        BookingBoardResolver,
        AddBookingResolver,
        MoveBookingResolver,
        ConfirmBookingResolver,
        CheckInBookingResolver,
        CompleteBookingResolver,
        MarkBookingNoShowResolver,
        CancelBookingResolver,
        SaveBookingServiceResolver,
        RemoveBookingServiceResolver,
        SaveBookingResourceResolver,
        RemoveBookingResourceResolver,
        SaveBookingHoursResolver,
        SaveBookingExceptionResolver,
        RemoveBookingExceptionResolver,
        SaveBookingPolicyResolver,
        SaveBookingPublicPageResolver,
        RemoveBookingWaitlistEntryResolver,
    ],
})
/** The GraphQL transport of the booking workbench. */
export class BookingGraphqlModule {}
