import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the content-items codes, Vietnamese and English. */
export const CONTENT_ITEMS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONTENT_ITEMS_NOT_FOUND": "Không tìm thấy bài đăng.",
        "errors.CONTENT_ITEMS_INVALID_INPUT": "Thông tin bài đăng không hợp lệ.",
        "errors.CONTENT_ITEMS_WRONG_STATUS": "Trạng thái bài đăng không cho phép thao tác này.",
        "errors.CONTENT_ITEMS_FROZEN": "Mở lại bản nháp trước khi sửa nội dung.",
        "errors.CONTENT_ITEMS_TEXT_MISSING": "Mỗi kênh cần có nội dung nháp.",
        "errors.CONTENT_ITEMS_INVALID_CHANNEL": "Kênh đăng không hợp lệ.",
        "errors.CONTENT_ITEMS_NOT_WRITTEN": "Không lưu được bài đăng.",
    },
    en: {
        "errors.CONTENT_ITEMS_NOT_FOUND": "The post was not found.",
        "errors.CONTENT_ITEMS_INVALID_INPUT": "The post fields are invalid.",
        "errors.CONTENT_ITEMS_WRONG_STATUS": "The post state does not allow this action.",
        "errors.CONTENT_ITEMS_FROZEN": "Reopen the draft before editing its text.",
        "errors.CONTENT_ITEMS_TEXT_MISSING": "Every channel needs draft text.",
        "errors.CONTENT_ITEMS_INVALID_CHANNEL": "The selected channel is invalid.",
        "errors.CONTENT_ITEMS_NOT_WRITTEN": "The post was not saved.",
    },
}
