import { BOOKING_PORTS } from "../api.options"
import type { DynamicModule } from "@nestjs/common"
import { BOOKINGS_ERROR_KINDS, BOOKINGS_MESSAGES, BookingsModule } from "@modules/domain/bookings"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The bookings area of the API, in registration order. */
export const bookingsModules = (): Array<DynamicModule> => [
    BookingsModule.register({ isGlobal: true, ...BOOKING_PORTS }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const bookingsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [BOOKINGS_ERROR_KINDS]

/** The message bundles of the capabilities this group registers, in registration order. */
export const bookingsMessages: ReadonlyArray<MessageBundle> = [BOOKINGS_MESSAGES]
