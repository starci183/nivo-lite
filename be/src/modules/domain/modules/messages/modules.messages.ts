import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the modules codes, Vietnamese and English. */
export const MODULES_MESSAGES: MessageBundle = {
    vi: {
        "errors.MODULES_NOT_FOUND": "Không tìm thấy agent {{key}}.",
        "errors.MODULES_CATALOG_INVALID": "Danh mục agent không hợp lệ: {{problems}}",
    },
    en: {
        "errors.MODULES_NOT_FOUND": "The agent {{key}} was not found.",
        "errors.MODULES_CATALOG_INVALID": "The agent catalogue is invalid: {{problems}}",
    },
}
