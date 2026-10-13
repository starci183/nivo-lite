import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the invoices codes, Vietnamese and English. */
export const INVOICES_MESSAGES: MessageBundle = {
    vi: {
        "errors.INVOICES_NOT_NUMBERED": "Không đánh được số hóa đơn.",
        "errors.INVOICES_NOT_FOUND": "Không tìm thấy hóa đơn trong không gian làm việc.",
    },
    en: {
        "errors.INVOICES_NOT_NUMBERED": "The invoice could not be numbered.",
        "errors.INVOICES_NOT_FOUND": "The invoice was not found in the workspace.",
    },
}
