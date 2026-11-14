import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the chat-node-ports codes, Vietnamese and English. */
export const CHAT_NODE_PORTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CHAT_NODE_PORTS_INVALID_PAYLOAD": "Tin gửi khách cần nội dung (và khách, kênh hoặc tài khoản khi không phải người đang trò chuyện).",
        "errors.CHAT_NODE_PORTS_DELIVERY_RATE_LIMITED":
            "Kênh chat đang tạm không nhận tin (hết hạn mức hoặc ngoài giờ gửi). Tin chưa gửi, hệ thống sẽ thử lại.",
    },
    en: {
        "errors.CHAT_NODE_PORTS_INVALID_PAYLOAD": "A message to a customer needs a text (and the customer, channel or account when it is not the person being served).",
        "errors.CHAT_NODE_PORTS_DELIVERY_RATE_LIMITED":
            "The chat channel is not taking messages for now (quota or night hours). Nothing was sent; the system will try again.",
    },
}
