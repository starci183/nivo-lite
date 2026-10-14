import type { MessageBundle } from "@modules/platform/i18n"

/** Safe display text of the liveness codes, Vietnamese and English. */
export const LIVENESS_MESSAGES: MessageBundle = {
    vi: {
        "errors.LIVENESS_READINESS_UNAVAILABLE": "Dịch vụ chưa sẵn sàng nhận yêu cầu. Vui lòng thử lại sau.",
    },
    en: {
        "errors.LIVENESS_READINESS_UNAVAILABLE": "The service is not ready to accept requests. Please try again later.",
    },
}
