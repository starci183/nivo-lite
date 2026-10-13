import type { MessageBundle } from "@modules/platform/i18n"

/** Localized agent chat refusals. */
export const AGENT_CHAT_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_CHAT_AGENT_NOT_FOUND": "Không tìm thấy nhân viên AI này.",
        "errors.AGENT_CHAT_CONVERSATION_NOT_FOUND": "Không tìm thấy cuộc trò chuyện này.",
        "errors.AGENT_CHAT_TURN_NOT_FOUND": "Không tìm thấy lượt trò chuyện này.",
        "errors.AGENT_CHAT_INVALID_BODY": "Tin nhắn cần từ 1 đến 4000 ký tự.",
    },
    en: {
        "errors.AGENT_CHAT_AGENT_NOT_FOUND": "That AI agent was not found.",
        "errors.AGENT_CHAT_CONVERSATION_NOT_FOUND": "That conversation was not found.",
        "errors.AGENT_CHAT_TURN_NOT_FOUND": "That chat turn was not found.",
        "errors.AGENT_CHAT_INVALID_BODY": "A message must contain 1 to 4000 characters.",
    },
}
