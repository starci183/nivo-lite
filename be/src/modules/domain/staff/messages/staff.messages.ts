import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the staff codes, Vietnamese and English. */
export const STAFF_MESSAGES: MessageBundle = {
    vi: {
        "errors.STAFF_NAME_REQUIRED": "Nhân sự cần có tên.",
        "errors.STAFF_NOT_FOUND": "Không tìm thấy nhân sự này trong không gian làm việc.",
    },
    en: {
        "errors.STAFF_NAME_REQUIRED": "A staff member needs a name.",
        "errors.STAFF_NOT_FOUND": "This staff member was not found in the workspace.",
    },
}
