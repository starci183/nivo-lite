import type { RightScope, RightsGrant } from "../rights/rights.types"
import type { Namespaced } from "../schema/schema.types"
import type { EffectDefinition } from "./effect.types"
import type { EffectPayload, NodeDefinition, NodeModel, NodeQuery, SubjectRef, TurnRef } from "./node.types"

/**
 * What a host gives the node runner, bound to one turn. The runner has already checked rights, declarations and payloads; a port only
 * reads, writes or acts, narrowing a `turn` read to the records the turn's subject is linked to.
 */
export interface NodeHostPorts {
    readonly read: (
        kind: string,
        query: NodeQuery,
        scope: RightScope,
    ) => Promise<ReadonlyArray<Readonly<Record<string, unknown>>>>
    readonly write: (kind: string, record: Readonly<Record<string, unknown>>) => Promise<SubjectRef>
    /** Runs an effect once per call key and, when given, once per workspace dedupe key: a repeat answers the first subject. */
    readonly execute: (effect: EffectDefinition, payload: EffectPayload, call: EffectCall) => Promise<SubjectRef>
    /** The model; the runner prefixes each purpose with the node id. */
    readonly model: NodeModel
    readonly now: () => Date
}

/** The keys of one effect call: the run step's own, and the node's business key or null. */
export interface EffectCall {
    readonly key: string
    readonly dedupeKey: string | null
}

/** One run of a node. */
export interface NodeRunRequest {
    readonly node: NodeDefinition
    readonly params: unknown
    readonly input: unknown
    readonly turn: TurnRef
    /** What the agent holds: default deny. */
    readonly grant: RightsGrant
    /** The installed effects by id. */
    readonly effects: ReadonlyMap<string, EffectDefinition>
    /** The idempotency key of the run (run and step); each effect's key adds its order. */
    readonly key: string
}

/** One effect a run did. */
export interface NodeRunEffect {
    readonly id: Namespaced
    readonly subject: SubjectRef
}

/** What a run came to: the parsed output and the effects it did, in order. */
export interface NodeRun {
    readonly output: unknown
    readonly effects: ReadonlyArray<NodeRunEffect>
}
