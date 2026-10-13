import { Module } from "@nestjs/common"
import { PublicBookingApiModule } from "../../public-booking.module"
import { PublicBookingController } from "./public-booking.controller"

@Module({ imports: [PublicBookingApiModule], controllers: [PublicBookingController] })
/** The HTTP transport of the public-booking feature. */
export class PublicBookingHttpModule {}
