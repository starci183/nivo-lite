import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the chat-node-ports codes, Vietnamese and English. */
export const CHAT_NODE_PORTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CHAT_NODE_PORTS_INVALID_PAYLOAD": "Tin gửi khách cần mã cuộc trò chuyện và nội dung.",
        "errors.CHAT_NODE_PORTS_CONVERSATION_NOT_FOUND": "Không tìm thấy cuộc trò chuyện.",
        "errors.CHAT_NODE_PORTS_WRONG_CONVERSATION":
            "Bước này chỉ được trả lời trong cuộc trò chuyện của lượt đang chạy.",
        "errors.CHAT_NODE_PORTS_HELD_BY_PERSON": "Một người đang xử lý cuộc trò chuyện này nên agent không gửi tin.",
        "errors.CHAT_NODE_PORTS_NOT_SPEAKING": "Agent khác đang phụ trách cuộc trò chuyện này nên không gửi tin.",
        "errors.CHAT_NODE_PORTS_ZALO_WINDOW_EXPIRED":
            "Khách nhắn lần cuối trên Zalo đã quá 48 giờ, nên không thể gửi tin trả lời.",
        "errors.CHAT_NODE_PORTS_DELIVERY_REJECTED": "Kênh chat từ chối tin nhắn.",
        "errors.CHAT_NODE_PORTS_DELIVERY_RATE_LIMITED":
            "Kênh chat đang tạm không nhận tin (hết hạn mức hoặc ngoài giờ gửi). Tin chưa gửi, hệ thống sẽ thử lại.",
        "errors.CHAT_NODE_PORTS_DELIVERY_UNCONFIRMED": "Kênh chat chưa xác nhận đã nhận tin nhắn.",
        "errors.CHAT_NODE_PORTS_RECIPIENT_UNREACHABLE":
            "Không gửi được tin cho khách: kênh chat không tìm thấy người nhận. Tin được giữ trong cuộc trò chuyện và đánh dấu chưa gửi.",
        "errors.CHAT_NODE_PORTS_CHANNEL_PLAN_BLOCKED":
            "Gói của kênh chat không cho agent trả lời. Tin được giữ trong cuộc trò chuyện và đánh dấu chưa gửi.",
        "errors.CHAT_NODE_PORTS_PROPOSAL_REFUSED": "Không lưu được bản trả lời AI soạn. Hãy thử lại.",
    },
    en: {
        "errors.CHAT_NODE_PORTS_INVALID_PAYLOAD": "A message to the customer needs a conversation id and a text.",
        "errors.CHAT_NODE_PORTS_CONVERSATION_NOT_FOUND": "The conversation was not found.",
        "errors.CHAT_NODE_PORTS_WRONG_CONVERSATION":
            "This step may only reply in the conversation of the running turn.",
        "errors.CHAT_NODE_PORTS_HELD_BY_PERSON": "A person is handling this conversation, so the agent sends nothing.",
        "errors.CHAT_NODE_PORTS_NOT_SPEAKING": "Another agent handles this conversation now, so nothing is sent.",
        "errors.CHAT_NODE_PORTS_ZALO_WINDOW_EXPIRED":
            "The customer last wrote on Zalo more than 48 hours ago, so a reply cannot be sent.",
        "errors.CHAT_NODE_PORTS_DELIVERY_REJECTED": "The chat channel refused the message.",
        "errors.CHAT_NODE_PORTS_DELIVERY_RATE_LIMITED":
            "The chat channel is not taking messages for now (quota or night hours). Nothing was sent; the system will try again.",
        "errors.CHAT_NODE_PORTS_DELIVERY_UNCONFIRMED": "The chat channel did not confirm it took the message.",
        "errors.CHAT_NODE_PORTS_RECIPIENT_UNREACHABLE":
            "The message could not be sent: the chat channel cannot find the recipient. It stays in the conversation marked not sent.",
        "errors.CHAT_NODE_PORTS_CHANNEL_PLAN_BLOCKED":
            "The plan of the chat channel does not let the agent answer. The message stays in the conversation marked not sent.",
        "errors.CHAT_NODE_PORTS_PROPOSAL_REFUSED": "The reply the AI drafted could not be stored. Try again.",
    },
}
