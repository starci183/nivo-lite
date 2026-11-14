import type { PluginNodeModel } from "@nivo-lite/agent-sdk/installation"

/**
 * The weight and the output bound of every Paperwork node that calls AI (D8: they stay on the node's registry row; the model itself is
 * the template node's `model`). A node that calls no AI has no row; a node of another package keeps its own package's row.
 */
export const WEBDOCS_NODE_MODELS: Readonly<Record<string, PluginNodeModel>> = {
    "webdocs.read": { model: "auto", weight: "light", maxOutputTokens: 4000 },
    "webdocs.draft": { model: "auto", weight: "heavy", maxOutputTokens: 6000 },
}
