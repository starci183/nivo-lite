import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the meta codes, Vietnamese and English. */
export const META_MESSAGES: MessageBundle = {
    vi: {
        "errors.META_NOT_CONFIGURED": "Tích hợp Facebook chưa được thiết lập trên NIVO này.",
        "errors.META_UNREACHABLE": "Không kết nối được tới Meta. Vui lòng thử lại.",
        "errors.META_REFUSED": "Meta từ chối yêu cầu.",
        "errors.META_CONTRACT_MISMATCH": "Meta trả về dữ liệu không đúng định dạng.",
    },
    en: {
        "errors.META_NOT_CONFIGURED": "The Facebook integration is not set up on this NIVO yet.",
        "errors.META_UNREACHABLE": "Could not reach Meta. Please try again.",
        "errors.META_REFUSED": "Meta refused the request.",
        "errors.META_CONTRACT_MISMATCH": "Meta answered in an unexpected shape.",
    },
}
