import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the meta-inbox codes, Vietnamese and English. */
export const META_INBOX_MESSAGES: MessageBundle = {
    vi: {
        "errors.META_INBOX_SIGNATURE_INVALID": "Chữ ký của Meta không hợp lệ.",
        "errors.META_INBOX_DELIVERY_INVALID": "Gói tin của Meta không đọc được.",
    },
    en: {
        "errors.META_INBOX_SIGNATURE_INVALID": "The Meta signature is not valid.",
        "errors.META_INBOX_DELIVERY_INVALID": "The Meta delivery cannot be read.",
    },
}
