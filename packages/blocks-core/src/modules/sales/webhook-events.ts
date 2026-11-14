import { defineWebhookEvent, type WebhookEventDefinition } from "@nivo-lite/agent-sdk/webhook"
import { SALES_MODULE_KEY } from "./declaration"

/** The outgoing events the Sales business raises: the owner picks them when connecting a webhook receiver (n8n, Make, Zapier). */
export const SALES_WEBHOOK_EVENTS: ReadonlyArray<WebhookEventDefinition> = [
    defineWebhookEvent({
        id: "deal.won",
        label: { vi: "Ch\u1ed1t \u0111\u01b0\u1ee3c kh\u00e1ch", en: "Customer won" },
        summary: { vi: "Khi m\u1ed9t kh\u00e1ch \u0111\u1ed3ng \u00fd mua.", en: "When a customer agrees to buy." },
        moduleKey: SALES_MODULE_KEY,
    }),
    defineWebhookEvent({
        id: "order.confirmed",
        label: { vi: "\u0110\u01a1n h\u00e0ng \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn", en: "An order is confirmed" },
        summary: { vi: "Khi m\u1ed9t \u0111\u01a1n h\u00e0ng \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn.", en: "When an order is confirmed." },
        moduleKey: SALES_MODULE_KEY,
    }),
    defineWebhookEvent({
        id: "payment.received",
        label: { vi: "Nh\u1eadn ti\u1ec1n", en: "Payment received" },
        summary: { vi: "Khi ti\u1ec1n c\u1ee7a m\u1ed9t \u0111\u01a1n v\u1ec1 t\u00e0i kho\u1ea3n.", en: "When the money of an order arrives." },
        moduleKey: SALES_MODULE_KEY,
    }),
]
