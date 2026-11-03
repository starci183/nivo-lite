import type { z } from "zod"
import type { Namespaced, SpecText } from "../schema/schema.types"
import type { DataRight } from "../rights/rights.types"

/** The role of a step in an agent's graph. */
export type NodeRole = "trigger" | "condition" | "execute" | "output"

/** The record a turn is about. */
export interface SubjectRef {
    /** The kind of record the turn is about. */
    readonly kind: string
    /** The id of the record within its kind. */
    readonly id: string
}

/** The turn a node runs in. */
export interface TurnRef {
    /** The id of the turn, which an effect or a write is recorded under. */
    readonly turnId: string
    /** The workspace the turn runs for; every record the node reaches belongs to it. */
    readonly workspaceId: string
    /** The agent whose grant bounds what the node may reach. */
    readonly agentId: string
    /** The record the turn is about; null when it is about none. */
    readonly subject: SubjectRef | null
}

/** A query a node runs through its rights-bound data port. */
export interface NodeQuery {
    /** The fields a record must equal to be returned; absent returns every record the rights reach. */
    readonly where?: Readonly<Record<string, string | number | boolean>>
    /** The fields to return; each must be covered by a right. */
    readonly fields: ReadonlyArray<string>
    /** The most records to return; absent returns all. */
    readonly limit?: number
}

/** Every call is checked against the node's declared rights and the agent's grant. */
export interface RightsBoundData {
    /** Reads records of a kind; refused with `RightsDeniedError` when the rights do not cover the kind and fields. */
    readonly read: <T>(kind: string, query: NodeQuery) => Promise<ReadonlyArray<T>>
    /** Writes a record of a kind and says which record it made; refused when the rights do not cover it. */
    readonly write: (kind: string, record: Readonly<Record<string, unknown>>) => Promise<SubjectRef>
}

/** What a node's `run` receives. */
export interface NodeContext {
    /** The turn the node runs in. */
    readonly turn: TurnRef
    /** The only way the node reaches records. */
    readonly data: RightsBoundData
    /** Records an effect that happened in this turn. An undeclared kind throws. */
    readonly effect: (kind: Namespaced, subject: SubjectRef) => void
    /** The time of the turn; a node reads the clock here, never from the system. */
    readonly now: () => Date
}

/** A stored rows fixture by data kind. */
export type NodeStore = Readonly<Record<string, ReadonlyArray<Readonly<Record<string, unknown>>>>>

/** One worked example of a node, which conformance runs. */
export interface NodeExample<I extends z.ZodType, O extends z.ZodType> {
    /** What the example shows, in a short phrase. */
    readonly name: string
    /** The input the node is run with. */
    readonly input: z.input<I>
    /** The output the node must return for the input. */
    readonly output: z.output<O>
    /** The effect kinds the node must record, in order. */
    readonly effects: ReadonlyArray<Namespaced>
    /** The records the node's data port holds while the example runs; absent holds none. */
    readonly store?: NodeStore
}

/** What `defineNode` takes. */
export interface NodeConfig<I extends z.ZodType, O extends z.ZodType> {
    /** The registry id a graph names the node by; unique across every package. */
    readonly id: Namespaced
    /** The role of the step the node plays in a graph. */
    readonly role: NodeRole
    /** The name the composer shows for the node. */
    readonly title: SpecText
    /** The schema of the input the node takes. */
    readonly input: I
    /** The schema of the output the node returns. */
    readonly output: O
    /** Required rights: an agent whose grant misses one cannot run the node. */
    readonly rights: ReadonlyArray<DataRight>
    /** The effect kinds it may record. */
    readonly effects: ReadonlyArray<Namespaced>
    /** The work of the node, given its parsed input and the context of the turn. */
    readonly run: (input: z.output<I>, context: NodeContext) => Promise<z.input<O>>
    /** Worked examples that conformance runs; at least one. */
    readonly examples: readonly [NodeExample<I, O>, ...Array<NodeExample<I, O>>]
}

/** A node as the registry holds it after `defineNode` checked it. */
export interface NodeDefinition<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> extends NodeConfig<
    I,
    O
> {
    /** Tells a node from a block, a read or an action in the registry. */
    readonly entry: "node"
}
