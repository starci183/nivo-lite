/** Log events of the graph nodes: ids and codes only, never the words of a customer. */
export enum GraphNodesLogEvent {
    /** The installed list has a problem: a duplicate, an undeclared effect or a right over an unknown kind. */
    InstallProblem = "graph_nodes.install_problem",
    /** An installed effect or data kind has no module that serves it yet. */
    Unserved = "graph_nodes.unserved",
    /** An effect repeated a key already in the ledger, so it did nothing and answered the first subject. */
    EffectReplayed = "graph_nodes.effect_replayed",
}
