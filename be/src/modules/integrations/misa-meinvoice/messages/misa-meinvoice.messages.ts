import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the MISA meInvoice codes, Vietnamese and English. */
export const MISA_MEINVOICE_MESSAGES: MessageBundle = {
    vi: {
        "errors.MISA_MEINVOICE_NOT_AVAILABLE": "Thao tác {{operation}} của MISA meInvoice chưa được hỗ trợ: chưa đọc được tài liệu tích hợp chính thức.",
    },
    en: {
        "errors.MISA_MEINVOICE_NOT_AVAILABLE": "The MISA meInvoice operation {{operation}} is not available: its official integration documentation could not be read.",
    },
}
