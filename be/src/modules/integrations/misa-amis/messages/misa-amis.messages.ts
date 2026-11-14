import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the MISA AMIS codes, Vietnamese and English. */
export const MISA_AMIS_MESSAGES: MessageBundle = {
    vi: {
        "errors.MISA_AMIS_NOT_AVAILABLE": "Thao tác {{operation}} của MISA AMIS Kế toán chưa được hỗ trợ: chưa đọc được tài liệu tích hợp chính thức.",
    },
    en: {
        "errors.MISA_AMIS_NOT_AVAILABLE": "The MISA AMIS operation {{operation}} is not available: its official integration documentation could not be read.",
    },
}
