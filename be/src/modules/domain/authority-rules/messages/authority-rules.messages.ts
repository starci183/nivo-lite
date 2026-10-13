import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the authority-rules codes, Vietnamese and English. */
export const AUTHORITY_RULES_MESSAGES: MessageBundle = {
    vi: {
        "errors.AUTHORITY_RULES_UNKNOWN_ACTION": "Hành động {{action}} không có trong danh mục.",
    },
    en: {
        "errors.AUTHORITY_RULES_UNKNOWN_ACTION": "The action {{action}} is not in the registry.",
    },
}
