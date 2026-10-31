import type { AgentGraphData } from "@/modules/types"

/** Fake data of the same shape as a graph: the skeleton of the panes is drawn from it while the graph is read. */
export const AGENT_GRAPH_PLACEHOLDER: AgentGraphData = {
    mode: "shadow",
    activeVersion: 0,
    changes: 0,
    gaps: 0,
    problems: [],
    nodes: [
        {
            key: "placeholder",
            kind: "trigger",
            title: "",
            doneBy: "nivo",
            card: { description: "", tone: "neutral", shape: "rect", count: "", isPlaceholder: false },
            knows: [],
            does: "",
            uses: [],
            reads: [],
            writes: [],
            approver: null,
            sources: [],
            next: [],
            intent: "",
            branches: [],
        },
    ],
    versions: [],
    proposals: [],
    runs: [],
    members: [],
}
