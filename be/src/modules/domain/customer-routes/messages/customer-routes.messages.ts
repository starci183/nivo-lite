import type { MessageBundle } from "@modules/platform/i18n"

/** The words of the customer routes: the refusals the engine's own callers can meet. */
export const CUSTOMER_ROUTES_MESSAGES: MessageBundle = {
    vi: {
        "errors.CUSTOMER_ROUTES_CONTACT_UNKNOWN": "Không tìm thấy khách để mở đường nhắn tin.",
        "errors.CUSTOMER_ROUTES_ID_TAKEN": "Mã đường nhắn tin này đã thuộc về một khách hoặc kênh khác.",
        "errors.CUSTOMER_ROUTES_DELIVERY_MISSING": "Hệ thống chưa đọc lại được tin vừa ghi nhận gửi cho khách.",
        "errors.CUSTOMER_ROUTES_LINE_MISSING": "Hệ thống chưa đọc lại được tin khách vừa nhắn.",
    },
    en: {
        "errors.CUSTOMER_ROUTES_CONTACT_UNKNOWN": "The customer to open a route for was not found.",
        "errors.CUSTOMER_ROUTES_ID_TAKEN": "This route id already belongs to another customer or channel.",
        "errors.CUSTOMER_ROUTES_DELIVERY_MISSING": "The message just recorded for the customer could not be read back.",
        "errors.CUSTOMER_ROUTES_LINE_MISSING": "The message the customer just sent could not be read back.",
    },
}
