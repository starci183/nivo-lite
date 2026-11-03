import type { NodeInstall } from "./graph-nodes.contracts"

/** What the app root decides for the graph-nodes capability. */
export interface GraphNodesOptions {
    /** The installed nodes, effects, tools and data kinds the app assembled from its node packages. */
    readonly install: NodeInstall
}
