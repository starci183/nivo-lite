import { BOOKING_PORTS } from "../api.options"
import type { DynamicModule } from "@nestjs/common"
import { BookingsModule } from "@modules/domain/bookings"
/** The bookings area of the API, in registration order. */
export const bookingsModules = (): Array<DynamicModule> => [
    BookingsModule.register({ isGlobal: true, ...BOOKING_PORTS }),
]
