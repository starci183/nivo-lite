import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the loyalty one-time codes codes, Vietnamese and English. */
export const LOYALTY_OTPS_MESSAGES: MessageBundle = {
    vi: {
        "errors.LOYALTY_OTPS_NOT_ISSUED": "Chưa tạo được mã xác nhận, bạn thử lại nhé.",
        "errors.LOYALTY_OTPS_PEPPER_TOO_SHORT": "Khóa băm mã xác nhận quá ngắn.",
    },
    en: {
        "errors.LOYALTY_OTPS_NOT_ISSUED": "The code could not be created, please try again.",
        "errors.LOYALTY_OTPS_PEPPER_TOO_SHORT": "The code hashing pepper is too short.",
    },
}
