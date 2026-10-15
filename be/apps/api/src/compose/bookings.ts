import type { ModuleMetadata } from "@nestjs/common"
import { BookingsModule } from "@modules/domain/bookings"
import { G19_PORTS } from "./ports"
/** The bookings area of the API, in registration order. */
export const bookingsModules = (): NonNullable<ModuleMetadata["imports"]> => [
    BookingsModule.register({ isGlobal: true, ...G19_PORTS.bookings }),
]
