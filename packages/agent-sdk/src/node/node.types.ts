import type { z } from "../schema/zod-entry"
import type { Namespaced, SpecText } from "../schema/schema.types"
import type { DataRight, RightsGrant } from "../rights/rights.types"

/** The role of a step in an agent's graph. */
export type NodeRole = "trigger" | "condition" | "execute" | "output"

/** The record a turn is about. */
export interface SubjectRef {
    /** The data kind of the record, such as an order or a person. */
    readonly kind: string
    /** The id of the record within its kind. */
    readonly id: string
}

/** The turn a node runs in. */
export interface TurnRef {
    /** The id of the turn, unique per run of the agent. */
    readonly turnId: string
    /** The workspace the turn belongs to, which scopes every read and write. */
    readonly workspaceId: string
    /** The agent running the turn, whose grant bounds what nodes may touch. */
    readonly agentId: string
    /** The record the turn is about, or null when the turn has none. */
    readonly subject: SubjectRef | null
}

/** A query a node runs through its rights-bound data port. */
export interface NodeQuery {
    /** Equality filters by field; absent reads every row the rights allow. */
    readonly where?: Readonly<Record<string, string | number | boolean>>
    /** The fields to return, each of which must be covered by a declared right. */
    readonly fields: ReadonlyArray<string>
    /** The most rows to return; the host applies its own cap when absent. */
    readonly limit?: number
}

/** Every call is checked against the node's declared rights and the agent's grant. */
export interface RightsBoundData {
    /** Reads rows of a data kind; throws when a right is not declared or granted. */
    readonly read: <T>(kind: string, query: NodeQuery) => Promise<ReadonlyArray<T>>
    /** Writes one record of a data kind and answers the subject it created or changed; throws when no write right is held. */
    readonly write: (kind: string, record: Readonly<Record<string, unknown>>) => Promise<SubjectRef>
}

/** What an effect carries; the effect's own schema judges it. */
export type EffectPayload = Readonly<Record<string, unknown>>

/** One call of the model: what it is for (a short kebab tag, metered under the node's namespace), how to answer, and on what. */
export interface NodeModelRequest {
    /** A short kebab tag that names why the call is made, used to meter it. */
    readonly purpose: string
    /** How the model should answer, in the words of the node author. */
    readonly instructions: string
    /** What the model works on, passed as data after the instructions. */
    readonly input: unknown
    /** Pictures the model should look at, as short-lived addresses the model host can fetch; none when absent. */
    readonly images?: ReadonlyArray<string> | undefined
}

/** The model as a node reaches it: through the host's metered path, never a provider of its own. */
export interface NodeModel {
    /** A free-text answer. */
    readonly text: (request: NodeModelRequest) => Promise<string>
    /** A structured answer, parsed by the schema. */
    readonly json: <S extends z.ZodType>(schema: S, request: NodeModelRequest) => Promise<z.output<S>>
}

/** How one effect call is told apart from a repeat. */
export interface EffectOptions {
    /**
     * A business key that makes the effect once per workspace across runs (`payment-request:<orderId>`): a repeat of the key does
     * nothing and answers the subject of the first. Without it the effect is once per run step.
     */
    readonly dedupeKey?: string
}

/** The NIVO MCP tools as a node reaches them: only the ones it declared, parsed both ways. */
export interface NodeTools {
    /** Calls a declared tool; the answer is parsed by the tool's result schema. */
    readonly call: <R = unknown>(name: Namespaced, args: Readonly<Record<string, unknown>>) => Promise<R>
}

/** What a node's `run` receives. */
export interface NodeContext<P extends z.ZodType = z.ZodType> {
    /** Which turn, workspace, agent and subject this run belongs to. */
    readonly turn: TurnRef
    /** The settings the graph spec gave this node, parsed by its `params` schema. */
    readonly params: z.output<P>
    /** The rights-bound port through which the node reads and writes records. */
    readonly data: RightsBoundData
    /** Runs an effect now and answers the subject it touched. An undeclared kind or a payload its schema refuses throws. */
    readonly effect: (kind: Namespaced, payload: EffectPayload, options?: EffectOptions) => Promise<SubjectRef>
    /** The metered model port for text and structured answers. */
    readonly model: NodeModel
    /** The port that calls the MCP tools the node declared. */
    readonly tools: NodeTools
    /** The clock of the run; nodes read time here so tests can fix it. */
    readonly now: () => Date
}

/** A stored rows fixture by data kind. */
export type NodeStore = Readonly<Record<string, ReadonlyArray<Readonly<Record<string, unknown>>>>>

/** An effect an example expects, by kind alone or with the payload it must carry. */
export type NodeExampleEffect = Namespaced | { readonly kind: Namespaced; readonly payload: EffectPayload }

/** One worked example of a node, which conformance runs. */
export interface NodeExample<I extends z.ZodType, O extends z.ZodType, P extends z.ZodType> {
    /** A short label shown when the example fails. */
    readonly name: string
    /** The settings the node runs with in this example. */
    readonly params: z.input<P>
    /** The input handed to the node in this example. */
    readonly input: z.input<I>
    /** The output the node must produce for the input. */
    readonly output: z.output<O>
    /** The effects the node must run, in order, and no others. */
    readonly effects: ReadonlyArray<NodeExampleEffect>
    /** The rows the data port holds during the example; empty when absent. */
    readonly store?: NodeStore
    /** The model's answers, in call order: a text for `text`, a value for `json`. */
    readonly model?: ReadonlyArray<unknown>
    /** The tools' results, in call order. */
    readonly tools?: ReadonlyArray<unknown>
    /** The agent's grant; the node's own rights when absent. */
    readonly grant?: RightsGrant
}

/** What `defineNode` takes. */
export interface NodeConfig<I extends z.ZodType, O extends z.ZodType, P extends z.ZodType> {
    /** The namespaced id a graph spec uses to place this node. */
    readonly id: Namespaced
    /** Which step of the graph the node can fill: trigger, condition, execute or output. */
    readonly role: NodeRole
    /** The words the editor shows for the node. */
    readonly title: SpecText
    /** The settings a graph spec gives the node; `z.object({})` when it takes none. */
    readonly params: P
    /** The schema the input is parsed with before the node runs. */
    readonly input: I
    /** A condition's output holds `branch`, which the graph routes on. */
    readonly output: O
    /** Required rights: an agent whose grant misses one cannot run the node. */
    readonly rights: ReadonlyArray<DataRight>
    /** The effect kinds it may run. */
    readonly effects: ReadonlyArray<Namespaced>
    /** The NIVO MCP tools it may call, by capability name; none when absent. */
    readonly tools?: ReadonlyArray<Namespaced>
    /** The work of the node. A method, so a list of nodes of different shapes holds together. */
    run(input: z.output<I>, context: NodeContext<P>): Promise<z.input<O>>
    /** At least one worked example, which conformance runs against the node. */
    readonly examples: readonly [NodeExample<I, O, P>, ...Array<NodeExample<I, O, P>>]
}

/** A node as registered: the config plus the tag a registry sorts on. */
export interface NodeDefinition<
    I extends z.ZodType = z.ZodType,
    O extends z.ZodType = z.ZodType,
    P extends z.ZodType = z.ZodType,
> extends NodeConfig<I, O, P> {
    /** Tag that tells a registry this definition is a node. */
    readonly entry: "node"
}
