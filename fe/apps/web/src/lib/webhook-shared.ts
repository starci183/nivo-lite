/** Client-safe facts about the outgoing webhook events (the wizard lists them; outbound-events.ts delivers them). */
export const WEBHOOK_EVENTS = ["lead.created", "deal.won", "order.confirmed", "payment.received", "handoff.requested", "decision.made"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const isWebhookEvent = (v: unknown): v is WebhookEvent => typeof v === "string" && (WEBHOOK_EVENTS as ReadonlyArray<string>).includes(v);

/** What each event means, in plain words. */
export const WEBHOOK_EVENT_LABEL: Readonly<Record<WebhookEvent, { readonly vi: string; readonly en: string }>> = {
  "lead.created": { vi: "Có khách mới", en: "A new customer" },
  "deal.won": { vi: "Chốt được khách", en: "A deal is won" },
  "order.confirmed": { vi: "Đơn hàng được xác nhận", en: "An order is confirmed" },
  "payment.received": { vi: "Nhận được tiền", en: "A payment is received" },
  "handoff.requested": { vi: "Cần người thật tiếp nhận", en: "A person is needed" },
  "decision.made": { vi: "Chủ shop đã duyệt hoặc từ chối", en: "The owner approved or rejected something" },
};
