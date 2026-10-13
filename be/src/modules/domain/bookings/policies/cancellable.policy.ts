import type { OptionalCancellableBooking } from "../booking-chat.contracts"
import type { CancellableBookingRow } from "../persistence/booking.rows"
import { bookingIsoOf } from "./zoned-time.policy"

/** A booking a customer may ask to cancel or move, from its row; none for no row. */
export const cancellableOf = (row: CancellableBookingRow | undefined): OptionalCancellableBooking =>
    row === undefined
        ? null
        : {
              id: row.id,
              leadId: row.lead_id,
              startIso: bookingIsoOf(row.start_ms),
              serviceName: row.service_name,
              customerName: row.customer_name,
          }
