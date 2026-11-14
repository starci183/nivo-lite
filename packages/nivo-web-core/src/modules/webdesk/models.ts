import type { PluginNodeModel } from "@nivo-lite/agent-sdk/installation"

/**
 * The weight and the output bound of every Support node that calls AI (D8: they stay on the node's registry row; the model itself is
 * the template node's `model`). A node that calls no AI has no row; a node of another package keeps its own package's row.
 */
export const WEBDESK_NODE_MODELS: Readonly<Record<string, PluginNodeModel>> = {
    "webdesk.understand-sales": { model: "auto", weight: "light", maxOutputTokens: 800 },
    "webdesk.identify": { model: "auto", weight: "light", maxOutputTokens: 1000 },
    "webdesk.ticket-open": { model: "auto", weight: "light", maxOutputTokens: 1200 },
    "webdesk.intake-linked": { model: "auto", weight: "light", maxOutputTokens: 1500 },
    "webdesk.check": { model: "auto", weight: "heavy", maxOutputTokens: 2000 },
    "webdesk.plan": { model: "auto", weight: "light", maxOutputTokens: 2500 },
    "webdesk.answer-plan": { model: "auto", weight: "heavy", maxOutputTokens: 2500 },
    "webdesk.team-answer": { model: "auto", weight: "light", maxOutputTokens: 1200, work: "chat_turn" },
}
