import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the google-connections codes, Vietnamese and English. */
export const GOOGLE_CONNECTIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.GOOGLE_CONNECTIONS_NOT_CONFIGURED": "Google chưa được thiết lập trên NIVO này. Bạn thử lại sau nhé.",
        "errors.GOOGLE_CONNECTIONS_START_FAILED": "Chưa bắt đầu được kết nối Google. Bạn thử lại nhé.",
        "errors.GOOGLE_CONNECTIONS_MISSING": "Chưa có tài khoản Google nào được kết nối.",
        "errors.GOOGLE_CONNECTIONS_LOST": "Kết nối Google đã bị thu hồi. Hãy kết nối lại.",
    },
    en: {
        "errors.GOOGLE_CONNECTIONS_NOT_CONFIGURED": "Google is not set up on this NIVO yet. Please try again later.",
        "errors.GOOGLE_CONNECTIONS_START_FAILED": "Could not start the Google connection. Please try again.",
        "errors.GOOGLE_CONNECTIONS_MISSING": "No Google account is connected.",
        "errors.GOOGLE_CONNECTIONS_LOST": "The Google connection was revoked. Connect it again.",
    },
}
