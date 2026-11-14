import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the TikTok codes, Vietnamese and English. */
export const TIKTOK_MESSAGES: MessageBundle = {
    vi: {
        "errors.TIKTOK_UNREACHABLE": "Không liên lạc được TikTok.",
        "errors.TIKTOK_NOT_CONFIGURED": "Hệ thống chưa được cấu hình ứng dụng TikTok.",
        "errors.TIKTOK_AUTH_FAILED": "TikTok không chấp nhận mã truy cập của kết nối.",
        "errors.TIKTOK_RATE_LIMITED": "TikTok yêu cầu chậm lại, thử lại sau.",
        "errors.TIKTOK_NOT_FOUND": "TikTok không tìm thấy thứ được hỏi.",
        "errors.TIKTOK_REJECTED": "TikTok từ chối yêu cầu đăng video.",
        "errors.TIKTOK_FAILED": "TikTok gặp lỗi khi xử lý yêu cầu.",
        "errors.TIKTOK_MALFORMED": "TikTok trả lời một nội dung không đọc được.",
    },
    en: {
        "errors.TIKTOK_UNREACHABLE": "TikTok could not be reached.",
        "errors.TIKTOK_NOT_CONFIGURED": "This deployment has no TikTok app configured.",
        "errors.TIKTOK_AUTH_FAILED": "TikTok did not accept the connection's access token.",
        "errors.TIKTOK_RATE_LIMITED": "TikTok asked to slow down; try again later.",
        "errors.TIKTOK_NOT_FOUND": "TikTok did not find what was asked.",
        "errors.TIKTOK_REJECTED": "TikTok refused the video request.",
        "errors.TIKTOK_FAILED": "TikTok failed while handling the request.",
        "errors.TIKTOK_MALFORMED": "TikTok answered something unreadable.",
    },
}
