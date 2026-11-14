import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the YouTube codes, Vietnamese and English. */
export const YOUTUBE_MESSAGES: MessageBundle = {
    vi: {
        "errors.YOUTUBE_UNREACHABLE": "Không liên lạc được YouTube.",
        "errors.YOUTUBE_AUTH_FAILED": "YouTube không chấp nhận quyền của kết nối Google để đăng video.",
        "errors.YOUTUBE_RATE_LIMITED": "YouTube yêu cầu chậm lại hoặc đã hết hạn mức, thử lại sau.",
        "errors.YOUTUBE_NOT_FOUND": "YouTube không tìm thấy thứ được hỏi.",
        "errors.YOUTUBE_REJECTED": "YouTube từ chối yêu cầu đăng video.",
        "errors.YOUTUBE_FAILED": "YouTube gặp lỗi khi đăng video.",
        "errors.YOUTUBE_MALFORMED": "YouTube trả lời một nội dung không đọc được.",
    },
    en: {
        "errors.YOUTUBE_UNREACHABLE": "YouTube could not be reached.",
        "errors.YOUTUBE_AUTH_FAILED": "YouTube did not accept the permission of the Google connection for publishing videos.",
        "errors.YOUTUBE_RATE_LIMITED": "YouTube asked to slow down or the quota is spent; try again later.",
        "errors.YOUTUBE_NOT_FOUND": "YouTube did not find what was asked.",
        "errors.YOUTUBE_REJECTED": "YouTube refused the video request.",
        "errors.YOUTUBE_FAILED": "YouTube failed while publishing the video.",
        "errors.YOUTUBE_MALFORMED": "YouTube answered something unreadable.",
    },
}
