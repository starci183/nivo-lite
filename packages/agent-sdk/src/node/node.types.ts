import type { z } from "zod"
import type { Namespaced, SpecText } from "../schema/schema.types"
import type { DataRight, RightsGrant } from "../rights/rights.types"

/** The role of a step in an agent's graph. */
export type NodeRole = "trigger" | "condition" | "execute" | "output"

/** The record a turn is about. */
export interface SubjectRef {
    readonly kind: string
    readonly id: string
}

/** The turn a node runs in. */
export interface TurnRef {
    readonly turnId: string
    readonly workspaceId: string
    readonly agentId: string
    readonly subject: SubjectRef | null
}

/** A query a node runs through its rights-bound data port. */
export interface NodeQuery {
    readonly where?: Readonly<Record<string, string | number | boolean>>
    readonly fields: ReadonlyArray<string>
    readonly limit?: number
}

/** Every call is checked against the node's declared rights and the agent's grant. */
export interface RightsBoundData {
    readonly read: <T>(kind: string, query: NodeQuery) => Promise<ReadonlyArray<T>>
    readonly write: (kind: string, record: Readonly<Record<string, unknown>>) => Promise<SubjectRef>
}

/** What an effect carries; the effect's own schema judges it. */
export type EffectPayload = Readonly<Record<string, unknown>>

/** One call of the model: what it is for (a short kebab tag, metered under the node's namespace), how to answer, and on what. */
export interface NodeModelRequest {
    readonly purpose: string
    readonly instructions: string
    readonly input: unknown
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
    readonly turn: TurnRef
    /** The settings the graph spec gave this node, parsed by its `params` schema. */
    readonly params: z.output<P>
    readonly data: RightsBoundData
    /** Runs an effect now and answers the subject it touched. An undeclared kind or a payload its schema refuses throws. */
    readonly effect: (kind: Namespaced, payload: EffectPayload, options?: EffectOptions) => Promise<SubjectRef>
    readonly model: NodeModel
    readonly tools: NodeTools
    readonly now: () => Date
}

/** A stored rows fixture by data kind. */
export type NodeStore = Readonly<Record<string, ReadonlyArray<Readonly<Record<string, unknown>>>>>

/** An effect an example expects, by kind alone or with the payload it must carry. */
export type NodeExampleEffect = Namespaced | { readonly kind: Namespaced; readonly payload: EffectPayload }

/** One worked example of a node, which conformance runs. */
export interface NodeExample<I extends z.ZodType, O extends z.ZodType, P extends z.ZodType> {
    readonly name: string
    readonly params: z.input<P>
    readonly input: z.input<I>
    readonly output: z.output<O>
    readonly effects: ReadonlyArray<NodeExampleEffect>
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
    readonly id: Namespaced
    readonly role: NodeRole
    readonly title: SpecText
    /** The settings a graph spec gives the node; `z.object({})` when it takes none. */
    readonly params: P
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
    readonly examples: readonly [NodeExample<I, O, P>, ...Array<NodeExample<I, O, P>>]
}

/** A node definition. */
export interface NodeDefinition<
    I extends z.ZodType = z.ZodType,
    O extends z.ZodType = z.ZodType,
    P extends z.ZodType = z.ZodType,
> extends NodeConfig<I, O, P> {
    readonly entry: "node"
}
