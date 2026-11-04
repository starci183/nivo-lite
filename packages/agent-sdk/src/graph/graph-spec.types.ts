import type { NodeInputBindings, NodeProblemCode, NodeRole } from "../node"
import type { DataRight } from "../rights/rights.types"
import type { JsonValue } from "../schema/schema.types"

/** The schema id of an agent graph spec. */
export type GraphSpecSchemaId = "nivo/agent-graph@1"

/** What can tag an agent: a customer channel, a /chats group, another agent, a system event or a schedule. */
export type GraphTagSource = "channel" | "chats-group" | "agent" | "system-event" | "schedule"

/**
 * How long a burst of tags from one source is gathered into one run: the quiet time after the last tag before the run starts (`window`,
 * "0s" turns it off), and the longest the burst may keep the run waiting from its first tag (`maxWait`, no shorter than the window).
 * Durations are written like "1500ms", "6s" or "1m".
 */
export interface GraphBurst {
    /** The quiet time after the last tag before the run starts; "0s" turns bursting off. */
    readonly window: string
    /** The longest the burst may hold the run from its first tag; no shorter than `window`. */
    readonly maxWait?: string | undefined
}

/** What wakes the graph: a tag, from any of its sources; one run per tag. A source without a `burst` takes the app's default. */
export interface GraphSpecTrigger {
    /** What wakes the graph; only a tag does. */
    readonly kind: "tag"
    /** The sources whose tags wake the graph. */
    readonly sources: ReadonlyArray<GraphTagSource>
    /** The burst setting per source; a source without one takes the app's default. */
    readonly burst?: { readonly [Source in GraphTagSource]?: GraphBurst | undefined } | undefined
}

/** The minimum an agent holds to run its graph: data rights, NIVO MCP tools and effects. Everything else is denied. */
export interface GraphSpecGrant {
    /** The data rights the agent holds while it runs this graph. */
    readonly rights: ReadonlyArray<DataRight>
    /** The names of the NIVO MCP tools the agent may call. */
    readonly tools: ReadonlyArray<string>
    /** The ids of the effects the agent may ask the host to run. */
    readonly effects: ReadonlyArray<string>
}

/** One node of a graph: the SDK node it runs, its settings, where its input comes from and where the run goes next. */
export interface GraphSpecNode {
    /** The id of the node within its graph; unique, and what references and routes name. */
    readonly key: string
    /** The role the node plays, which decides what the runner does with it. */
    readonly kind: NodeRole
    /** The id of the SDK step this node runs. */
    readonly step: string
    /** The settings of the step, parsed by the step against its own schema. */
    readonly params?: Readonly<Record<string, JsonValue>> | undefined
    /** Where each input field of the step comes from: a literal or a reference to the trigger or an upstream node. */
    readonly input?: NodeInputBindings | undefined
    /** The node that follows, for a node that is not a condition; none ends the run. */
    readonly next?: string | undefined
    /** The node each branch of a condition goes to; a branch with no entry ends the run. */
    readonly routes?: Readonly<Record<string, string>> | undefined
}

/** One agent graph as data: seeded into the database, composed only of SDK node ids. The first node starts the run. */
export interface GraphSpec {
    /** The schema id of the document; a graph under another id is refused. */
    readonly schema: GraphSpecSchemaId
    /** The module whose agent runs it. */
    readonly moduleKey: string
    /** What wakes the graph. */
    readonly trigger: GraphSpecTrigger
    /** The most the agent may hold to run this graph. */
    readonly grant: GraphSpecGrant
    /** The nodes of the graph; the first one starts the run. */
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
    | "GRAPH_COMPENSABLE_AFTER_PIVOT"
    | "GRAPH_BURST_INVALID"

/** One problem of a graph spec and where it is: a node key, or a granted right, tool or effect. */
export interface GraphSpecProblem {
    /** The reason the graph spec was refused; stable, so a caller can branch on it. */
    readonly code: GraphSpecProblemCode
    /** Where the fault is: a node key, or the granted right, tool or effect. */
    readonly at: string
}
