import type { BookingBoard, BookingBoardParams } from "@modules/domain/bookings"

/** The workspace and optional date range of the booking workbench. */
export type GetBookingBoardRequest = Readonly<BookingBoardParams>

/** The model, appointments, waiting customers and statistics of the booking workbench. */
export type GetBookingBoardResult = Readonly<BookingBoard>
