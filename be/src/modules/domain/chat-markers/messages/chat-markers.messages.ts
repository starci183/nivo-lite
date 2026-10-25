import type { MessageBundle } from "@modules/platform/i18n"

/** Localized chat state refusals. */
export const CHAT_MARKERS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CHAT_MARKERS_TARGET_NOT_FOUND": "Không tìm thấy cuộc trò chuyện.",
        "errors.CHAT_MARKERS_MESSAGE_NOT_FOUND": "Không tìm thấy tin nhắn trong cuộc trò chuyện.",
    },
    en: {
        "errors.CHAT_MARKERS_TARGET_NOT_FOUND": "The conversation was not found.",
        "errors.CHAT_MARKERS_MESSAGE_NOT_FOUND": "The message was not found in this conversation.",
    },
}
