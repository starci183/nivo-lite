import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the loyalty ledger codes, Vietnamese and English. */
export const LOYALTY_LEDGER_MESSAGES: MessageBundle = {
    vi: {
        "errors.LOYALTY_LEDGER_CUSTOMER_NOT_FOUND": "Không tìm thấy khách này trong chương trình.",
        "errors.LOYALTY_LEDGER_INSUFFICIENT_POINTS": "Khách không đủ điểm để trừ.",
        "errors.LOYALTY_LEDGER_NOT_POSTED": "Chưa ghi được điểm, bạn thử lại nhé.",
    },
    en: {
        "errors.LOYALTY_LEDGER_CUSTOMER_NOT_FOUND": "This customer is not in the programme.",
        "errors.LOYALTY_LEDGER_INSUFFICIENT_POINTS": "The customer does not have enough points.",
        "errors.LOYALTY_LEDGER_NOT_POSTED": "The points could not be saved, please try again.",
    },
}
