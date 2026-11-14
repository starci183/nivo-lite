import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the Meta publishing codes, Vietnamese and English. */
export const META_PUBLISHING_MESSAGES: MessageBundle = {
    vi: {
        "errors.META_PUBLISHING_UNREACHABLE": "Không liên lạc được Meta để đăng bài.",
        "errors.META_PUBLISHING_AUTH_FAILED": "Meta không chấp nhận token hoặc quyền của kết nối để đăng bài.",
        "errors.META_PUBLISHING_RATE_LIMITED": "Meta yêu cầu chậm lại, thử lại sau.",
        "errors.META_PUBLISHING_NOT_FOUND": "Meta không tìm thấy thứ được hỏi.",
        "errors.META_PUBLISHING_REJECTED": "Meta từ chối yêu cầu đăng bài.",
        "errors.META_PUBLISHING_FAILED": "Meta gặp lỗi khi đăng bài.",
        "errors.META_PUBLISHING_MALFORMED": "Meta trả lời một nội dung không đọc được.",
    },
    en: {
        "errors.META_PUBLISHING_UNREACHABLE": "Meta could not be reached to publish.",
        "errors.META_PUBLISHING_AUTH_FAILED": "Meta did not accept the token or permission of the connection for publishing.",
        "errors.META_PUBLISHING_RATE_LIMITED": "Meta asked to slow down; try again later.",
        "errors.META_PUBLISHING_NOT_FOUND": "Meta did not find what was asked.",
        "errors.META_PUBLISHING_REJECTED": "Meta refused the publishing request.",
        "errors.META_PUBLISHING_FAILED": "Meta failed while publishing.",
        "errors.META_PUBLISHING_MALFORMED": "Meta answered something unreadable.",
    },
}
