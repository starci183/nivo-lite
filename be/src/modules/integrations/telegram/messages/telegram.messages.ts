import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the Telegram codes, Vietnamese and English. */
export const TELEGRAM_MESSAGES: MessageBundle = {
    vi: {
        "errors.TELEGRAM_UNAVAILABLE": "Telegram hiện không phản hồi.",
        "errors.TELEGRAM_REJECTED": "Telegram từ chối yêu cầu {{method}}: {{reason}}.",
    },
    en: {
        "errors.TELEGRAM_UNAVAILABLE": "Telegram is not answering.",
        "errors.TELEGRAM_REJECTED": "Telegram refused the {{method}} request: {{reason}}.",
    },
}
