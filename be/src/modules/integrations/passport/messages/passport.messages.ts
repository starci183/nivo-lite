import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the passport codes, Vietnamese and English. */
export const PASSPORT_MESSAGES: MessageBundle = {
    vi: {
        "errors.PASSPORT_ACCESS_TOKEN_INVALID": "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
        "errors.PASSPORT_KEY_INVALID": "Khóa ký phiên đăng nhập bị lỗi.",
        "errors.PASSPORT_MISSING_CREDENTIALS": "Hãy nhập email và mật khẩu.",
        "errors.PASSPORT_GOOGLE_STATE_INVALID": "Phiên đăng nhập Google không hợp lệ. Hãy thử lại.",
        "errors.PASSPORT_GOOGLE_REJECTED": "Google không xác nhận được tài khoản này.",
        "errors.PASSPORT_GOOGLE_UNAVAILABLE": "Đăng nhập bằng Google chưa được bật.",
    },
    en: {
        "errors.PASSPORT_ACCESS_TOKEN_INVALID": "The session is invalid or has expired.",
        "errors.PASSPORT_KEY_INVALID": "The session signing key is unusable.",
        "errors.PASSPORT_MISSING_CREDENTIALS": "Enter your email and password.",
        "errors.PASSPORT_GOOGLE_STATE_INVALID": "The Google sign-in could not be verified. Please try again.",
        "errors.PASSPORT_GOOGLE_REJECTED": "Google could not confirm this account.",
        "errors.PASSPORT_GOOGLE_UNAVAILABLE": "Google sign-in is not enabled.",
    },
}
