import type { MessageBundle } from "@modules/platform/i18n"

/** The evidence summaries for booking notices delivered through a customer's conversation. */
export const BOOKING_PORTS_MESSAGES: MessageBundle = {
    vi: {
        "bookingPorts.delivered": "Đã nhắn khách qua {{channel}}",
        "bookingPorts.failed": "Chưa nhắn được khách",
    },
    en: {
        "bookingPorts.delivered": "Notified the customer through {{channel}}",
        "bookingPorts.failed": "Could not notify the customer",
    },
}
