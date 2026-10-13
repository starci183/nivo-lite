import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-conversations codes, Vietnamese and English. */
export const AGENT_CONVERSATIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_CONVERSATIONS_NOT_FOUND": "Không tìm thấy cuộc trò chuyện này.",
        "errors.AGENT_CONVERSATIONS_NOT_STORED": "Không lưu được cuộc trò chuyện.",
    },
    en: {
        "errors.AGENT_CONVERSATIONS_NOT_FOUND": "That conversation was not found.",
        "errors.AGENT_CONVERSATIONS_NOT_STORED": "The conversation could not be stored.",
    },
}
