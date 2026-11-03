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

/** The model port of the host: the agents' AiTasksService path, metered. */
export interface NodeModel {
    /** A text answer. */
    readonly text: (request: ModelRequest) => Promise<string>
    /** A typed answer, read with the schema. */
    readonly json: <T>(schema: z.ZodType<T>, request: ModelRequest) => Promise<T>
}

/** What a node asks the model. */
export interface ModelRequest {
    /** A short kebab tag of what the call is for. */
    readonly purpose: string
    readonly instructions: string
    readonly input: unknown
}

/** What a node's `run` receives. */
export interface NodeContext {
    readonly turn: TurnRef
    /** The per-graph settings the owner set, read with the node's `params` schema. */
    readonly params: Readonly<Record<string, unknown>>
    readonly data: RightsBoundData
    /** Records an effect that happened in this turn, with its payload. An undeclared kind throws. */
    readonly effect: (kind: Namespaced, subject: SubjectRef, payload?: unknown) => Promise<SubjectRef>
    readonly model: NodeModel
    readonly now: () => Date
}

/** An effect an example expects: the kind, and its payload when the example pins it. */
export type ExampleEffect = Namespaced | { readonly kind: Namespaced; readonly payload?: unknown }

/** A stored rows fixture by data kind. */
export type NodeStore = Readonly<Record<string, ReadonlyArray<Readonly<Record<string, unknown>>>>>

/** One worked example of a node, which conformance runs. */
export interface NodeExample<I extends z.ZodType, O extends z.ZodType> {
    readonly name: string
    readonly input: z.input<I>
    readonly output: z.output<O>
    readonly effects: ReadonlyArray<ExampleEffect>
    readonly params?: Readonly<Record<string, unknown>>
    /** The canned answers of the model, in call order. */
    readonly model?: ReadonlyArray<unknown>
    /** The grant the agent holds in this example; the node's own rights when absent. */
    readonly grant?: RightsGrant
    readonly store?: NodeStore
}

/** What `defineNode` takes. */
export interface NodeConfig<I extends z.ZodType, O extends z.ZodType> {
    readonly id: Namespaced
    readonly role: NodeRole
    readonly title: SpecText
    /** The per-graph settings, a zod object; absent means none. */
    readonly params?: z.ZodType
    readonly input: I
    readonly output: O
    /** Required rights: an agent whose grant misses one cannot run the node. */
    readonly rights: ReadonlyArray<DataRight>
    /** The effect kinds it may record. */
    readonly effects: ReadonlyArray<Namespaced>
    readonly run: (input: z.output<I>, context: NodeContext) => Promise<z.input<O>>
    readonly examples: readonly [NodeExample<I, O>, ...Array<NodeExample<I, O>>]
}

/** A node definition. */
export interface NodeDefinition<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> extends NodeConfig<
    I,
    O
> {
    readonly entry: "node"
}
