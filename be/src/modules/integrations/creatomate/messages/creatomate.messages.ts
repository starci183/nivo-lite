import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the Creatomate codes, Vietnamese and English. */
export const CREATOMATE_MESSAGES: MessageBundle = {
    vi: {
        "errors.CREATOMATE_UNREACHABLE": "Không liên lạc được Creatomate.",
        "errors.CREATOMATE_AUTH_FAILED": "Creatomate không chấp nhận API key của kết nối.",
        "errors.CREATOMATE_RATE_LIMITED": "Creatomate yêu cầu chậm lại, thử lại sau.",
        "errors.CREATOMATE_NOT_FOUND": "Creatomate không tìm thấy lần dựng được hỏi.",
        "errors.CREATOMATE_REJECTED": "Creatomate từ chối yêu cầu dựng video.",
        "errors.CREATOMATE_FAILED": "Creatomate gặp lỗi khi dựng video.",
        "errors.CREATOMATE_MALFORMED": "Creatomate trả lời một nội dung không đọc được.",
    },
    en: {
        "errors.CREATOMATE_UNREACHABLE": "Creatomate could not be reached.",
        "errors.CREATOMATE_AUTH_FAILED": "Creatomate did not accept the API key of the connection.",
        "errors.CREATOMATE_RATE_LIMITED": "Creatomate asked to slow down; try again later.",
        "errors.CREATOMATE_NOT_FOUND": "Creatomate did not find the render that was asked for.",
        "errors.CREATOMATE_REJECTED": "Creatomate refused the video request.",
        "errors.CREATOMATE_FAILED": "Creatomate failed while composing the video.",
        "errors.CREATOMATE_MALFORMED": "Creatomate answered something unreadable.",
    },
}
