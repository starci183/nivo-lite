import { defineWebhookEvent, type WebhookEventDefinition } from "@nivo-lite/agent-sdk/webhook"
import { CHATBOT_MODULE_KEY } from "./declaration"

/** The outgoing events the Chatbot's business raises: the owner picks them when connecting a webhook receiver (n8n, Make, Zapier). */
export const CHATBOT_WEBHOOK_EVENTS: ReadonlyArray<WebhookEventDefinition> = [
    defineWebhookEvent({
        id: "lead.created",
        label: { vi: "Khách mới", en: "New customer" },
        summary: { vi: "Khi một người lạ nhắn lần đầu và được ghi nhận là khách.", en: "When a first-time sender is recorded as a customer." },
        moduleKey: CHATBOT_MODULE_KEY,
        sample: { lead_id: "00000000-0000-0000-0000-000000000000", name: "NIVO test", phone: "0900000000", need: "NIVO sample event" },
    }),
    defineWebhookEvent({
        id: "handoff.requested",
        label: { vi: "Cần người thật tiếp nhận", en: "A person is needed" },
        summary: { vi: "Khi trợ lý nhờ người thật tiếp nhận cuộc trò chuyện.", en: "When the assistant asks a person to take over the conversation." },
        moduleKey: CHATBOT_MODULE_KEY,
    }),
]
