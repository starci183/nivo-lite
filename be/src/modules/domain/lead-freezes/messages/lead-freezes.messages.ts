import type { MessageBundle } from "@modules/platform/i18n"

/** The words of the freezes of customers: the refusals of the pages. */
export const LEAD_FREEZES_MESSAGES: MessageBundle = {
    vi: {
        "errors.LEAD_FREEZES_RECORD_UNREADABLE": "Hệ thống chưa đọc được trạng thái chờ của khách này.",
        "errors.LEAD_FREEZES_CONTENDED": "Trạng thái chờ của khách vừa thay đổi. Hãy thử lại.",
        "errors.LEAD_FREEZES_NOT_FOUND": "Khách này không còn chờ bạn xử lý lỗi.",
    },
    en: {
        "errors.LEAD_FREEZES_RECORD_UNREADABLE": "The waiting state of this customer could not be read.",
        "errors.LEAD_FREEZES_CONTENDED": "The waiting state of this customer just changed. Please try again.",
        "errors.LEAD_FREEZES_NOT_FOUND": "This customer is no longer waiting for you to handle an error.",
    },
}
