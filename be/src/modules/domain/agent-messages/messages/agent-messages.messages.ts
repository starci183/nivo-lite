import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-messages codes, Vietnamese and English. */
export const AGENT_MESSAGES_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_MESSAGES_NOT_FOUND": "Không tìm thấy tin nhắn này.",
        "errors.AGENT_MESSAGES_NOT_STORED": "Không lưu được tin nhắn.",
    },
    en: {
        "errors.AGENT_MESSAGES_NOT_FOUND": "That message was not found.",
        "errors.AGENT_MESSAGES_NOT_STORED": "The message could not be stored.",
    },
}
