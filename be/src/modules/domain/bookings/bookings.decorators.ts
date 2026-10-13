import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { BookingNotifier } from "./bookings.contracts"

/** Token of the delivery of booking notices into the chat of a customer. */
export const BOOKINGS_NOTIFIER: unique symbol = Symbol("domain.bookings.notifier")

/** Injects the delivery of booking notices. Parameter type: BookingNotifier. */
export const InjectBookingNotifier = (): TypedParameterDecorator<BookingNotifier> =>
    injector<BookingNotifier>(BOOKINGS_NOTIFIER)
