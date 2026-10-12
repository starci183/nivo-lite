import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the Zalo codes, Vietnamese and English. */
export const ZALO_MESSAGES: MessageBundle = {
    vi: {
        "errors.ZALO_UNAVAILABLE": "Zalo hiện không phản hồi.",
        "errors.ZALO_REJECTED": "Zalo từ chối yêu cầu {{path}}: {{reason}}.",
    },
    en: {
        "errors.ZALO_UNAVAILABLE": "Zalo is not answering.",
        "errors.ZALO_REJECTED": "Zalo refused the {{path}} request: {{reason}}.",
    },
}
