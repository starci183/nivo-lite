import type { PluginNodeModel } from "@nivo-lite/agent-sdk/installation"

/**
 * The weight and the output bound of every Accounting node that calls AI (D8: they stay on the node's registry row; the model itself is
 * the template node's `model`). A node that calls no AI has no row; a node of another package keeps its own package's row.
 */
export const WEBBOOKS_NODE_MODELS: Readonly<Record<string, PluginNodeModel>> = {
    "webbooks.due": { model: "auto", weight: "light", maxOutputTokens: 3000 },
    "webbooks.notice-team": { model: "auto", weight: "light", maxOutputTokens: 800 },
    "webbooks.notice-draft": { model: "auto", weight: "heavy", maxOutputTokens: 1500 },
    "webbooks.round-report": { model: "auto", weight: "light", maxOutputTokens: 1500 },
    "webbooks.invoice-draft": { model: "auto", weight: "heavy", maxOutputTokens: 1200 },
    "webbooks.invoice-mail": { model: "auto", weight: "light", maxOutputTokens: 1500 },
    "webbooks.invoice-team": { model: "auto", weight: "light", maxOutputTokens: 800 },
    "webbooks.payment-settle": { model: "auto", weight: "heavy", maxOutputTokens: 1500 },
    "webbooks.renewal-paid-team": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "webbooks.purchase-paid-team": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "webbooks.supplier-check": { model: "auto", weight: "heavy", maxOutputTokens: 1200 },
    "webbooks.supplier-report": { model: "auto", weight: "light", maxOutputTokens: 1500 },
    "webbooks.team-answer": { model: "auto", weight: "light", maxOutputTokens: 1200, work: "chat_turn" },
}
