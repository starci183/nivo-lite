import type { MessageBundle } from "@modules/platform/i18n"

/** Customer reply refusals and audit lines, in the caller's language. */
export const CHATREPLY_MESSAGES: MessageBundle = {
    vi: {
        "errors.CHATREPLY_NOT_FOUND": "Không tìm thấy cuộc trò chuyện hoặc câu trả lời này.",
        "errors.CHATREPLY_NOT_HELD": "Hãy tiếp nhận cuộc trò chuyện trước khi trả lời.",
        "errors.CHATREPLY_HELD_BY_OTHER": "Một người khác đang xử lý cuộc trò chuyện này.",
        "errors.CHATREPLY_ANSWER_MISMATCH": "Yêu cầu trả lời không thuộc cuộc trò chuyện này.",
        "errors.CHATREPLY_INVALID_BODY": "Câu trả lời phải có từ 1 đến 4000 ký tự.",
        "chatreply.takenOver": "{{name}} đã tiếp nhận cuộc trò chuyện.",
        "chatreply.released": "{{name}} đã giao lại cuộc trò chuyện cho AI.",
        "chatreply.replyQueued": "{{name}} đã gửi một câu trả lời.",
    },
    en: {
        "errors.CHATREPLY_NOT_FOUND": "That conversation or reply no longer exists.",
        "errors.CHATREPLY_NOT_HELD": "Take over the conversation before replying.",
        "errors.CHATREPLY_HELD_BY_OTHER": "Someone else is handling this conversation.",
        "errors.CHATREPLY_ANSWER_MISMATCH": "That answer request does not belong to this conversation.",
        "errors.CHATREPLY_INVALID_BODY": "The reply must contain between 1 and 4000 characters.",
        "chatreply.takenOver": "{{name}} took over the conversation.",
        "chatreply.released": "{{name}} handed the conversation back to the AI.",
        "chatreply.replyQueued": "{{name}} sent a reply.",
    },
}
