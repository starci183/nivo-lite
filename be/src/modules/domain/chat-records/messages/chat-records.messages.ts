import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the chat-records codes, Vietnamese and English. */
export const CHAT_RECORDS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CHAT_RECORDS_NOT_FOUND": "Không tìm thấy cuộc trò chuyện hoặc tin nhắn này.",
        "errors.CHAT_RECORDS_NOT_STORED": "Không lưu được cuộc trò chuyện hoặc tin nhắn.",
    },
    en: {
        "errors.CHAT_RECORDS_NOT_FOUND": "That conversation or message was not found.",
        "errors.CHAT_RECORDS_NOT_STORED": "The conversation or message could not be stored.",
    },
}
