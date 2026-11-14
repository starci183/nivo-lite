import type { NodeInputBindings, NodeProblemCode, NodeRole } from "../node"
import type { JsonValue } from "../schema/schema.types"
import type {
    ContractProblemCode,
    WorkflowContract,
    WorkflowEntry,
    WorkflowOutcome,
    WorkflowTrigger,
} from "./workflow-contract"

/** The schema id of an agent graph spec. */
export type GraphSpecSchemaId = "nivo/agent-graph@1"

/** What can tag an agent: a customer channel, a /chats group, another agent, a system event or a schedule. */
export type GraphTagSource = "channel" | "chats-group" | "agent" | "system-event" | "schedule"

/** What wakes the graph: a tag, from any of its sources; one run per tag. */
export interface GraphSpecTrigger {
    /** What wakes the graph; only a tag does. */
    readonly kind: "tag"
    /** The sources whose tags wake the graph. */
    readonly sources: ReadonlyArray<GraphTagSource>
}

/**
 * The minimum an agent holds to run its graph: NIVO MCP tools and effects, by name. Everything else is denied. There is no data right
 * (`nivo-frame.rights`); a stored grant that still carries `rights` parses and drops them.
 */
export interface GraphSpecGrant {
    /** The names of the NIVO MCP tools the agent may call. */
    readonly tools: ReadonlyArray<string>
    /** The ids of the effects the agent may ask the host to run. */
    readonly effects: ReadonlyArray<string>
}

/** How a node asks to call one operation on an account: by itself, or only after a person approved the call. */
export type GraphNodeAccountMode = "auto" | "ask"

/**
 * One provider a node lists, in its order of priority (nivo-frame `templates`: the ToolRunner binds each to the agent's attached account
 * of that provider and tries them by data, then by this order). The node's ONE mode is the node's own (`GraphSpecNode.mode`), never a
 * member of an account.
 */
export interface GraphNodeAccount {
    /** The kind of the account, by the host's names (`messaging`, `payment`, `books`, `mail`, `records`). */
    readonly kind: string
    /** The provider of the account (`zalo_oa`, `sepay`), or null for any provider of the kind (a send acts on the conversation's own). */
    readonly provider: string | null
    /** The connected account, or null in a template: bound in the workspace, as a trigger source is. */
    readonly connectionId: string | null
    /**
     * LEGACY, read only: the operations a node stored before the node's own `mode` asked for on the account, each with its mode (by tool
     * id, or by the id of a work action the node's definition lists). Never written now; a stored document that holds it is read as
     * written (its modes are the node's mode when the node states none). An empty set is refused.
     */
    readonly operations?: Readonly<Record<string, GraphNodeAccountMode>> | undefined
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
    /** False makes the node a side step whose failure the run records and goes past; absent takes the node's own `blocking`. */
    readonly blocking?: boolean | undefined
    /** The visible group the node belongs to in the graph view (a sub-flow such as the sales consult); absent for a node on its own. */
    readonly group?: string | undefined
    /** What the node waits for, for the graph view: the customer's reply, a payment or something else, with its timeout and reminder. */
    readonly wait?: GraphSpecWait | undefined
    /**
     * The model the node's AI calls use: `auto` (the host picks per call by the step's weight) or a model id of the host's
     * vocabulary. The template declares it; the shop may change it per node. Absent: the host's declaration for the node's step.
     * The host checks the id against its vocabulary; this schema only bounds its form.
     */
    readonly model?: string | undefined
    /**
     * How the node's calls run (nivo-frame `rights`): `auto` runs them; `ask` interrupts for a person's approval on a card, then runs. ONE
     * mode per node; the engine has no default. Always written for a node step read from a template graph (the step's mode, else its
     * node's); absent on the engine's own control steps (`core.call-workflow`, `core.outcome`, the loops, the conditions), which make the
     * engine's own calls, and on a stored node from before the member (its accounts' `operations` then state it).
     */
    readonly mode?: GraphNodeAccountMode | undefined
    /**
     * The providers the node acts through, in priority order (each bound to the agent's attached account of it). Absent on a node from
     * before node rights. An empty list acts through NIVO's own tools only.
     */
    readonly accounts?: ReadonlyArray<GraphNodeAccount> | undefined
}

/** What a waiting node waits for and how long, as durations like "2h" or "30m". */
export interface GraphSpecWait {
    /** What the node waits for. */
    readonly kind: "reply" | "payment" | "other"
    /** How long it waits before it gives up; absent for no timeout. */
    readonly timeout?: string | undefined
    /** When it nudges the other side; absent for no reminder. */
    readonly reminder?: string | undefined
}

/** One agent graph as data: seeded into the database, composed only of SDK node ids. The first node starts the run. */
export interface GraphSpec {
    /** The schema id of the document; a graph under another id is refused. */
    readonly schema: GraphSpecSchemaId
    /** The module whose agent runs it. */
    readonly moduleKey: string
    /** The inputs a run of this workflow version needs, which its trigger's source (or its callers) must supply. */
    readonly contract?: WorkflowContract | undefined
    /**
     * The inputs of the workflow: each a source (channel kind and connection) with its conditions, each supplying the full contract.
     * `trigger.sources` must be exactly their wakes. Absent on a graph from before contracts.
     */
    readonly triggers?: ReadonlyArray<WorkflowTrigger> | undefined
    /** The named business ends of the workflow, each with the outputs it hands on (`out.<name>`). */
    readonly outcomes?: ReadonlyArray<WorkflowOutcome> | undefined
    /** Who may call the workflow by an end hand-off; absent is open to any workflow of the workspace. */
    readonly entry?: WorkflowEntry | undefined
    /** The wake envelope: the tag sources routing reads. */
    readonly trigger: GraphSpecTrigger
    /** The most the agent may hold to run this graph. */
    readonly grant: GraphSpecGrant
    /** The nodes of the graph; the first one starts the run. */
    readonly nodes: ReadonlyArray<GraphSpecNode>
}

/** Why the accounts a node asks for are refused. */
export type NodeAccountProblemCode =
    /** An operation the node's definition lists in neither its effects nor its tools: the node could never call it. */
    | "NODE_ACCOUNT_OPERATION_UNDECLARED"
    /** Two entries of one node for the same kind, provider and connection. */
    | "NODE_ACCOUNT_DUPLICATE"
    /** An entry that asks for no operation. */
    | "NODE_ACCOUNT_EMPTY"
    /** A kind the host does not know, or a provider that is not of the kind. Judged only when the host told its kinds. */
    | "NODE_ACCOUNT_KIND_UNKNOWN"
    /** An operation asked on `auto` that may only run after a person approved it. Judged only when the host told which are. */
    | "NODE_ACCOUNT_ASK_ONLY"

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
    | NodeAccountProblemCode
    | ContractProblemCode

/** One problem of a graph spec and where it is: a node key, or a granted right, tool or effect. */
export interface GraphSpecProblem {
    /** The reason the graph spec was refused; stable, so a caller can branch on it. */
    readonly code: GraphSpecProblemCode
    /** Where the fault is: a node key, or the granted right, tool or effect. */
    readonly at: string
}
