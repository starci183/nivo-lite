import type { PluginNodeModel } from "@nivo-lite/agent-sdk/installation"

/**
 * The weight and the output bound of every Sales node that calls AI (D8: they survive on the template node's registry row; the model
 * itself is the node's `claude-sonnet-5-5`). Heavy: the quote message (a figure the customer reads), settling who the customer is, the
 * link choice, the close's team line with the contract request, and the chat turn. The plain calls (`websales.quote-create`,
 * `websales.follow-record`, `websales.accept`) call no AI and have no row.
 */
export const WEBSALES_NODE_MODELS: Readonly<Record<string, PluginNodeModel>> = {
    "websales.purchase-open": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "websales.purchase-note": { model: "auto", weight: "light", maxOutputTokens: 800 },
    "websales.understand": { model: "auto", weight: "light", maxOutputTokens: 1200 },
    "websales.ask": { model: "auto", weight: "light", maxOutputTokens: 1200 },
    "websales.quote-send": { model: "auto", weight: "heavy", maxOutputTokens: 2500 },
    "websales.heard-reply": { model: "auto", weight: "light", maxOutputTokens: 800 },
    "websales.heard-notify": { model: "auto", weight: "light", maxOutputTokens: 800 },
    "websales.purchase-lose": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "websales.lost-notify": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "websales.due": { model: "auto", weight: "light", maxOutputTokens: 3000 },
    "websales.follow-send": { model: "auto", weight: "light", maxOutputTokens: 1500 },
    "websales.round-report": { model: "auto", weight: "light", maxOutputTokens: 2000 },
    "websales.team-route": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "websales.team-answer": { model: "auto", weight: "heavy", maxOutputTokens: 1200, work: "chat_turn" },
    "websales.close-find": { model: "auto", weight: "light", maxOutputTokens: 1200 },
    "websales.customer-propose": { model: "auto", weight: "heavy", maxOutputTokens: 800 },
    "websales.pay-instruct": { model: "auto", weight: "light", maxOutputTokens: 2000 },
    "websales.close-notify": { model: "auto", weight: "heavy", maxOutputTokens: 2500 },
    "websales.link-find": { model: "auto", weight: "light", maxOutputTokens: 1000 },
    "websales.link-write": { model: "auto", weight: "heavy", maxOutputTokens: 400 },
    "websales.link-notify": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "websales.handover-notify": { model: "auto", weight: "light", maxOutputTokens: 1500 },
    "websales.paid-tell": { model: "auto", weight: "light", maxOutputTokens: 1200 },
    "websales.mail-purchase-open": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "websales.mail-understand": { model: "auto", weight: "light", maxOutputTokens: 1000 },
    "websales.mail-reply-draft": { model: "auto", weight: "light", maxOutputTokens: 2000 },
    "websales.mail-notify": { model: "auto", weight: "light", maxOutputTokens: 800 },
}
