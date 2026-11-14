import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the Shotstack codes, Vietnamese and English. */
export const SHOTSTACK_MESSAGES: MessageBundle = {
    vi: {
        "errors.SHOTSTACK_UNREACHABLE": "Không liên lạc được Shotstack.",
        "errors.SHOTSTACK_AUTH_FAILED": "Shotstack không chấp nhận API key của kết nối.",
        "errors.SHOTSTACK_RATE_LIMITED": "Shotstack yêu cầu chậm lại, thử lại sau.",
        "errors.SHOTSTACK_NOT_FOUND": "Shotstack không tìm thấy bản dựng được hỏi.",
        "errors.SHOTSTACK_REJECTED": "Shotstack từ chối yêu cầu dựng video.",
        "errors.SHOTSTACK_FAILED": "Shotstack gặp lỗi khi dựng video.",
        "errors.SHOTSTACK_MALFORMED": "Shotstack trả lời một nội dung không đọc được.",
    },
    en: {
        "errors.SHOTSTACK_UNREACHABLE": "Shotstack could not be reached.",
        "errors.SHOTSTACK_AUTH_FAILED": "Shotstack did not accept the API key of the connection.",
        "errors.SHOTSTACK_RATE_LIMITED": "Shotstack asked to slow down; try again later.",
        "errors.SHOTSTACK_NOT_FOUND": "Shotstack did not find the render that was asked.",
        "errors.SHOTSTACK_REJECTED": "Shotstack refused the video render request.",
        "errors.SHOTSTACK_FAILED": "Shotstack failed while rendering the video.",
        "errors.SHOTSTACK_MALFORMED": "Shotstack answered something unreadable.",
    },
}
