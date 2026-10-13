import { Module } from "@nestjs/common"
import { BookingApiModule } from "../../booking.module"
import { BookingController } from "./booking.controller"

@Module({ imports: [BookingApiModule], controllers: [BookingController] })
/** The HTTP transport of the booking feature. */
export class BookingHttpModule {}
