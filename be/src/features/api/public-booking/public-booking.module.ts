import { Module } from "@nestjs/common"
import { GetBookingPageHandler } from "./application/get-booking-page.handler"
import { ListFreeTimesHandler } from "./application/list-free-times.handler"
import { RequestBookingHandler } from "./application/request-booking.handler"
import { ConfigurableModuleClass } from "./public-booking.module-definition"

@Module({
    providers: [GetBookingPageHandler, ListFreeTimesHandler, RequestBookingHandler],
})
/** The public-booking feature: the handlers of its application. */
export class PublicBookingApiModule extends ConfigurableModuleClass {}
