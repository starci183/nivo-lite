import type { RightScope, RightsGrant } from "../rights/rights.types"
import type { Namespaced } from "../schema/schema.types"
import type { EffectDefinition, ToolDefinition } from "./effect.types"
import type { EffectPayload, NodeDefinition, NodeHostModel, NodeQuery, SubjectRef, TurnRef } from "./node.types"

/**
 * What a host gives the node runner, bound to one turn. The runner has already checked rights, declarations and payloads; a port only
 * reads, writes or acts, narrowing a `turn` read to the records the turn's subject is linked to.
 */
export interface NodeHostPorts {
    /** Reads records of a kind within the scope the right allows; resolves to the asked fields only. */
    readonly read: (
        kind: string,
        query: NodeQuery,
        scope: RightScope,
    ) => Promise<ReadonlyArray<Readonly<Record<string, unknown>>>>
    /** Writes one record of a kind and resolves to a reference to the stored subject. */
    readonly write: (kind: string, record: Readonly<Record<string, unknown>>) => Promise<SubjectRef>
    /** Runs an effect once per call key and, when given, once per workspace dedupe key: a repeat answers the first subject. */
    readonly execute: (effect: EffectDefinition, payload: EffectPayload, call: EffectCall) => Promise<SubjectRef>
    /** Calls a tool through the NIVO MCP door; the runner has parsed the args and parses the answer. */
    readonly callTool: (tool: ToolDefinition, args: Readonly<Record<string, unknown>>, key: string) => Promise<unknown>
    /** The model; the runner prefixes each purpose with the node id. */
    readonly model: NodeHostModel
    /** The clock of the run, so a node never reads the system time itself. */
    readonly now: () => Date
}

/** The keys of one effect call: the run step's own, and the node's business key or null. */
export interface EffectCall {
    /** The key of this call within the run step: the step, then a digest of the effect and its arguments; the same key answers the same subject. */
    readonly key: string
    /** The node's business key, when it gave one; a repeat in the workspace answers the first subject. */
    readonly dedupeKey: string | null
}

/** One run of a node. */
export interface NodeRunRequest {
    /** The definition of the node being run. */
    readonly node: NodeDefinition
    /** The raw settings from the graph, parsed by the runner against the node's schema. */
    readonly params: unknown
    /** The raw input resolved from the graph's bindings, parsed against the node's schema. */
    readonly input: unknown
    /** The turn the run belongs to; it narrows `turn` scoped reads. */
    readonly turn: TurnRef
    /** What the agent holds: default deny. */
    readonly grant: RightsGrant
    /** The installed effects by id. */
    readonly effects: ReadonlyMap<string, EffectDefinition>
    /** The installed tools by id. */
    readonly tools: ReadonlyMap<string, ToolDefinition>
    /**
     * The words of a text key of the install, in the language model calls are written in, or undefined for a key it does not know.
     * The runner shows the agent what each tool does in these words; without them a title given by key shows as the key.
     */
    readonly words?: ((key: string) => string | undefined) | undefined
    /** The idempotency key of the run (run and step); each call's key adds a digest of what is called and with what. */
    readonly key: string
}

/** One effect a run did. */
export interface NodeRunEffect {
    /** The id of the effect that was run. */
    readonly id: Namespaced
    /** The subject the effect touched or made. */
    readonly subject: SubjectRef
}

/** What a run came to: the parsed output and the effects it did, in order. */
export interface NodeRun {
    /** The node's parsed output. */
    readonly output: unknown
    /** The effects the run did, in the order it did them. */
    readonly effects: ReadonlyArray<NodeRunEffect>
}
