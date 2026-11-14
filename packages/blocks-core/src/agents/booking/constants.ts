/** The permission to see the Booking workbench. */
export const BOOKING_VIEW = "booking.view"

/** The permission to change the calendar: services, resources, hours, rules and the status of a booking. */
export const BOOKING_MANAGE = "booking.manage"

/** The permissions of the Booking module (owners and managers hold every permission of a module). */
export const BOOKING_PERMISSIONS: ReadonlyArray<string> = [BOOKING_VIEW, BOOKING_MANAGE]
