import type { PluginNodeModel } from "@nivo-lite/agent-sdk/installation"

/**
 * The weight and the output bound of every Renewal node that calls AI (D8: they stay on the node's registry row; the model itself is
 * the template node's `model`). A node that calls no AI has no row; a node of another package keeps its own package's row.
 */
export const WEBRENEW_NODE_MODELS: Readonly<Record<string, PluginNodeModel>> = {
    "webrenew.due": { model: "auto", weight: "light", maxOutputTokens: 6000 },
    "webrenew.remind-send": { model: "auto", weight: "light", maxOutputTokens: 1500 },
    "webrenew.round-report": { model: "auto", weight: "light", maxOutputTokens: 2000 },
    "webrenew.understand-open": { model: "auto", weight: "light", maxOutputTokens: 800 },
    "webrenew.quote-open": { model: "auto", weight: "heavy", maxOutputTokens: 600 },
    "webrenew.quote-tell": { model: "auto", weight: "heavy", maxOutputTokens: 2000 },
    "webrenew.quote-tell-mail": { model: "auto", weight: "heavy", maxOutputTokens: 2000 },
    "webrenew.close-team": { model: "auto", weight: "light", maxOutputTokens: 1000 },
    "webrenew.close-thank": { model: "auto", weight: "light", maxOutputTokens: 400 },
    "webrenew.reply-answer": { model: "auto", weight: "light", maxOutputTokens: 1500 },
    "webrenew.unlinked-tell": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "webrenew.paid-team": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "webrenew.paid-ack": { model: "auto", weight: "light", maxOutputTokens: 400 },
    "webrenew.mail-reply-record": { model: "auto", weight: "light", maxOutputTokens: 800 },
    "webrenew.mail-reply-team": { model: "auto", weight: "light", maxOutputTokens: 600 },
    "webrenew.renewed-team": { model: "auto", weight: "light", maxOutputTokens: 800 },
    "webrenew.renewed-tell": { model: "auto", weight: "light", maxOutputTokens: 1000 },
    "webrenew.team-answer": { model: "auto", weight: "light", maxOutputTokens: 1200, work: "chat_turn" },
}
