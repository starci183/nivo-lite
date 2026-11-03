import type { NodeInputBindings, NodeProblemCode, NodeRole } from "../node"
import type { DataRight } from "../rights/rights.types"

/** The schema id of an agent graph spec. */
export type GraphSpecSchemaId = "nivo/agent-graph@1"

/** What can tag an agent: a customer channel, a /chats group, another agent, a system event or a schedule. */
export type GraphTagSource = "channel" | "chats-group" | "agent" | "system-event" | "schedule"

/** What wakes the graph: a tag, from any of its sources; one run per tag. */
export interface GraphSpecTrigger {
    readonly kind: "tag"
    readonly sources: ReadonlyArray<GraphTagSource>
}

/** The minimum an agent holds to run its graph: data rights, NIVO MCP tools and effects. Everything else is denied. */
export interface GraphSpecGrant {
    readonly rights: ReadonlyArray<DataRight>
    readonly tools: ReadonlyArray<string>
    readonly effects: ReadonlyArray<string>
}

/** One node of a graph: the SDK node it runs, its settings, where its input comes from and where the run goes next. */
export interface GraphSpecNode {
    readonly key: string
    readonly kind: NodeRole
    readonly step: string
    readonly params?: Readonly<Record<string, unknown>> | undefined
    readonly input?: NodeInputBindings | undefined
    /** The node that follows, for a node that is not a condition; none ends the run. */
    readonly next?: string | undefined
    /** The node each branch of a condition goes to; a branch with no entry ends the run. */
    readonly routes?: Readonly<Record<string, string>> | undefined
}

/** One agent graph as data: seeded into the database, composed only of SDK node ids. The first node starts the run. */
export interface GraphSpec {
    readonly schema: GraphSpecSchemaId
    /** The module whose agent runs it. */
    readonly moduleKey: string
    readonly trigger: GraphSpecTrigger
    readonly grant: GraphSpecGrant
    readonly nodes: ReadonlyArray<GraphSpecNode>
}

/** What a graph spec is refused for, over and above the node problems. */
export type GraphSpecProblemCode =
    | NodeProblemCode
    | "GRAPH_NODE_DUPLICATE"
    | "GRAPH_TARGET_UNKNOWN"
    | "GRAPH_REF_NOT_UPSTREAM"
    | "GRAPH_NODE_UNREACHABLE"
    | "GRAPH_GRANT_EXCESS"
    | "GRAPH_EFFECTS_MISMATCH"
    | "GRAPH_TOOLS_MISMATCH"

/** One problem of a graph spec and where it is: a node key, or a granted right, tool or effect. */
export interface GraphSpecProblem {
    readonly code: GraphSpecProblemCode
    readonly at: string
}
