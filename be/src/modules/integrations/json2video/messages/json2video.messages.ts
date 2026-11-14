import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the JSON2Video codes, Vietnamese and English. */
export const JSON2VIDEO_MESSAGES: MessageBundle = {
    vi: {
        "errors.JSON2VIDEO_UNREACHABLE": "Không liên lạc được JSON2Video.",
        "errors.JSON2VIDEO_AUTH_FAILED": "JSON2Video không chấp nhận kết nối này (hết hạn mức hoặc không đủ quyền).",
        "errors.JSON2VIDEO_RATE_LIMITED": "JSON2Video yêu cầu chậm lại, thử lại sau.",
        "errors.JSON2VIDEO_NOT_FOUND": "JSON2Video không tìm thấy thứ được hỏi.",
        "errors.JSON2VIDEO_REJECTED": "JSON2Video từ chối yêu cầu dựng video.",
        "errors.JSON2VIDEO_FAILED": "JSON2Video gặp lỗi khi dựng video.",
        "errors.JSON2VIDEO_MALFORMED": "JSON2Video trả lời một nội dung không đọc được.",
    },
    en: {
        "errors.JSON2VIDEO_UNREACHABLE": "JSON2Video could not be reached.",
        "errors.JSON2VIDEO_AUTH_FAILED": "JSON2Video did not accept this connection (quota used up or not allowed).",
        "errors.JSON2VIDEO_RATE_LIMITED": "JSON2Video asked to slow down; try again later.",
        "errors.JSON2VIDEO_NOT_FOUND": "JSON2Video did not find what was asked.",
        "errors.JSON2VIDEO_REJECTED": "JSON2Video refused the video request.",
        "errors.JSON2VIDEO_FAILED": "JSON2Video failed while composing the video.",
        "errors.JSON2VIDEO_MALFORMED": "JSON2Video answered something unreadable.",
    },
}
