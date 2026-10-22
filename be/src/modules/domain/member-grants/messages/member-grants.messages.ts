import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the member-grants codes, Vietnamese and English. */
export const MEMBER_GRANTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.MEMBER_GRANTS_UNKNOWN_TARGET": "Không tìm thấy thành viên hoặc hành động này.",
        "errors.MEMBER_GRANTS_INVALID_LIMIT": "Hạn mức duyệt không hợp lệ: phải là số không âm.",
    },
    en: {
        "errors.MEMBER_GRANTS_UNKNOWN_TARGET": "That member or action no longer exists.",
        "errors.MEMBER_GRANTS_INVALID_LIMIT":
            "The approval limit is not valid: it must be a number that is not negative.",
    },
}
