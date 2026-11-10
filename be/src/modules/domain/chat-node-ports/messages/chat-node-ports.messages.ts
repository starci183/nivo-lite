import type { MessageBundle } from "@modules/platform/i18n"
import type { DraftCopy } from "../chat-node-ports.policy"

/** The owner's notice of a draft to a customer, by language; a language without its own copy reads the English one. */
export const DRAFT_COPY: Readonly<Record<string, DraftCopy>> = {
    vi: {
        title: "Duyệt tin gửi khách",
        lead: "Tin soạn cho {who}, chờ anh/chị duyệt trong hộp thư Chatbot:",
        someone: "khách",
    },
    en: {
        title: "Approve a message to a customer",
        lead: "A message drafted for {who}, waiting for your approval in the Chatbot inbox:",
        someone: "the customer",
    },
}

/** The copy of the owner's notice in a language. */
export const draftCopyOf = (locale: string): DraftCopy =>
    DRAFT_COPY[locale] ?? { title: "Approve a message to a customer", lead: "A message drafted for {who}:", someone: "the customer" }

/** Display text of the chat-node-ports codes, Vietnamese and English. */
export const CHAT_NODE_PORTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CHAT_NODE_PORTS_INVALID_PAYLOAD": "Tin gửi khách cần cuộc trò chuyện hoặc khách, và nội dung.",
        "errors.CHAT_NODE_PORTS_DELIVERY_RATE_LIMITED":
            "Kênh chat đang tạm không nhận tin (hết hạn mức hoặc ngoài giờ gửi). Tin chưa gửi, hệ thống sẽ thử lại.",
        "errors.CHAT_NODE_PORTS_PROPOSAL_REFUSED": "Không lưu được bản nháp chờ duyệt. Hãy thử lại.",
    },
    en: {
        "errors.CHAT_NODE_PORTS_INVALID_PAYLOAD": "A message to a customer needs a conversation or a customer, and a text.",
        "errors.CHAT_NODE_PORTS_DELIVERY_RATE_LIMITED":
            "The chat channel is not taking messages for now (quota or night hours). Nothing was sent; the system will try again.",
        "errors.CHAT_NODE_PORTS_PROPOSAL_REFUSED": "The draft waiting for approval could not be stored. Try again.",
    },
}
