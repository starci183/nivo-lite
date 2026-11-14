import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the Veo codes, Vietnamese and English. */
export const VEO_MESSAGES: MessageBundle = {
    vi: {
        "errors.VEO_UNREACHABLE": "Không liên lạc được Google Veo.",
        "errors.VEO_AUTH_FAILED": "Google không chấp nhận API key của kết nối Veo.",
        "errors.VEO_RATE_LIMITED": "Google yêu cầu chậm lại, thử lại sau.",
        "errors.VEO_NOT_FOUND": "Google không tìm thấy thứ được hỏi.",
        "errors.VEO_REJECTED": "Google từ chối yêu cầu tạo video.",
        "errors.VEO_FAILED": "Google gặp lỗi khi tạo video.",
        "errors.VEO_MALFORMED": "Google trả lời một nội dung không đọc được.",
    },
    en: {
        "errors.VEO_UNREACHABLE": "Google Veo could not be reached.",
        "errors.VEO_AUTH_FAILED": "Google did not accept the API key of the Veo connection.",
        "errors.VEO_RATE_LIMITED": "Google asked to slow down; try again later.",
        "errors.VEO_NOT_FOUND": "Google did not find what was asked.",
        "errors.VEO_REJECTED": "Google refused the video request.",
        "errors.VEO_FAILED": "Google failed while generating the video.",
        "errors.VEO_MALFORMED": "Google answered something unreadable.",
    },
}
