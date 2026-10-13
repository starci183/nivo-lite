import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the webhook-delivery codes, Vietnamese and English. */
export const WEBHOOK_DELIVERY_MESSAGES: MessageBundle = {
    vi: {
        "errors.WEBHOOK_DELIVERY_TARGET_REFUSED": "Địa chỉ webhook không dùng được: {{reason}}.",
    },
    en: {
        "errors.WEBHOOK_DELIVERY_TARGET_REFUSED": "The webhook address cannot be used: {{reason}}.",
    },
}
