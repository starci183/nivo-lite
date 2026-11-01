import type { MessageBundle } from "@modules/platform/i18n"

/** Localized copy for chat file errors. */
export const CHAT_FILES_MESSAGES: MessageBundle = {
    vi: {
        "chatFiles.fileSent": "Đã gửi một tệp",
        "errors.CHAT_FILES_INVALID": "Tệp phải là ảnh JPEG, PNG, WebP hoặc PDF, tối đa 10 MB.",
        "errors.CHAT_FILES_PATH_INVALID": "Tệp này không thuộc cuộc trò chuyện.",
        "errors.CHAT_FILES_STORAGE_UNAVAILABLE": "Chưa truy cập được kho tệp. Hãy thử lại sau.",
    },
    en: {
        "chatFiles.fileSent": "Sent a file",
        "errors.CHAT_FILES_INVALID": "Use a JPEG, PNG or WebP image or a PDF of at most 10 MB.",
        "errors.CHAT_FILES_PATH_INVALID": "This file does not belong to the conversation.",
        "errors.CHAT_FILES_STORAGE_UNAVAILABLE": "The file store is unavailable. Try again later.",
    },
}
