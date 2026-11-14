import type { PluginNodeModel } from "@nivo-lite/agent-sdk/installation"

/**
 * The weight and the output bound of every Mailbox node that calls AI (D8: they stay on the node's registry row; the model itself is
 * the template node's `model`). A node that calls no AI has no row; a node of another package keeps its own package's row.
 */
export const WEBMAIL_NODE_MODELS: Readonly<Record<string, PluginNodeModel>> = {
    "webmail.sort": { model: "auto", weight: "light", maxOutputTokens: 1200 },
    "webmail.sorted-report": { model: "auto", weight: "heavy", maxOutputTokens: 2000 },
}
