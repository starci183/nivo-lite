import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the conversations codes and the lines the capability writes into a conversation, Vietnamese and English. */
export const CONVERSATIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONVERSATIONS_NOT_ANSWERED": "Tin nhắn này không cần trả lời.",
        "errors.CONVERSATIONS_TURN_TARGET_MISSING": "Cuộc trò chuyện hoặc tin nhắn cần trả lời không còn tồn tại.",
        "conversations.photoSent": "Khách gửi một ảnh",
        "conversations.zaloGuest": "Khách Zalo",
        "conversations.fallbackGreeting": "Xin chào! Mình là trợ lý AI của cửa hàng. Bạn cần tư vấn gì ạ?",
        "conversations.holdingReply": "Dạ em đã ghi nhận, nhân viên sẽ phản hồi anh/chị sớm ạ",
        "conversations.chatUnavailable":
            "AI chưa trả lời kịp: khách đã nhận tin nhắn giữ chỗ và câu hỏi được chuyển cho nhân viên",
        "conversations.chatNeedsHuman":
            "Câu trả lời chi tiết cần người duyệt — NIVO đã gửi đề xuất cho chủ doanh nghiệp",
    },
    en: {
        "errors.CONVERSATIONS_NOT_ANSWERED": "This message does not need an answer.",
        "errors.CONVERSATIONS_TURN_TARGET_MISSING": "The conversation or the message to answer no longer exists.",
        "conversations.photoSent": "The customer sent a photo",
        "conversations.zaloGuest": "Zalo customer",
        "conversations.fallbackGreeting": "Hello! I am the shop's AI assistant. How can I help you?",
        "conversations.holdingReply": "We have noted your message and the team will get back to you soon",
        "conversations.chatUnavailable":
            "The AI could not answer in time: the customer got the holding message and the question is handed to a person",
        "conversations.chatNeedsHuman":
            "The detailed answer needs a person: NIVO sent its proposed answer to the owner to approve",
    },
}
