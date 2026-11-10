import type { RightScope, RightsGrant } from "../rights/rights.types"
import type { Namespaced } from "../schema/schema.types"
import type { EffectDefinition, ToolDefinition } from "./effect.types"
import type {
    EffectPayload,
    NodeConfusion,
    NodeDefinition,
    NodeHostModel,
    NodeQuery,
    SubjectRef,
    TurnRef,
} from "./node.types"

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
    /**
     * How the model takes the turns of a step's agent, when the host does that itself (a native tool-calling loop). The runner hands
     * over the frame of the step and its own closures; the host only moves the model from turn to turn and answers each of its calls
     * with what the closure answered. Absent, the runner takes the turns itself over `model.json` (one JSON answer per turn).
     */
    readonly agent?: ((loop: NodeAgentLoop) => Promise<NodeAgentLoopEnd>) | undefined
}

/** A tool as the agent is shown it: one of the agent's whole set, the same for every step. */
export interface NodeAgentLoopTool {
    /** The id of the effect or tool (`customer.message.send`). */
    readonly name: string
    /** What it does, in words the model can read. */
    readonly does: unknown
    /** The JSON Schema of its arguments, as the runner shows it (no dialect address, no description said twice), or null. */
    readonly argsSchema: unknown
}

/** Why a call or an answer was refused, as the fact the agent reads: a stable code, bounded words, and the true values given with it. */
export interface NodeAgentRefusal {
    /** The stable code (`TOOL_NOT_OFFERED`, `REQUIRED_CALL_MISSING`, a tool's own refusal id). */
    readonly code: string
    /** Bounded words. */
    readonly message: string
    /** The true values the refusal came with, when it gave any. */
    readonly data?: unknown
}

/**
 * What one call of the agent came to, as the fact the model reads next: the subject an effect touched, the result a tool answered, or
 * why the call was refused. A refusal is an answer, never a throw: the closure throws nothing.
 */
export type NodeAgentCallAnswer =
    | { readonly ok: true; readonly subject: SubjectRef }
    | { readonly ok: true; readonly result: unknown }
    | { readonly ok: false; readonly refused: NodeAgentRefusal }

/** What the runner says to an output or a confusion the model gave: taken (the step's agent has ended), or refused with why. */
export type NodeAgentEndAnswer = { readonly ok: true } | { readonly ok: false; readonly refused: NodeAgentRefusal }

/**
 * One run of a step's agent, as the runner hands it to a host that takes the turns itself. The words are laid out for the prompt
 * cache: `instructions` is the same for every step of the agent, `step` for every try of the step, the rest changes from call to call.
 * `call`, `done` and `confused` are the runner's own: every check, the call keys, the refusal shape, the required calls and the output
 * schema stay there, whatever loop the host runs. The host shows the model `tools` (plus its own ways to say "done" and "confused"),
 * answers each tool call of the model with `call`, an output with `done` and a confusion with `confused`, one after the other (never
 * two at once), and returns when `done` or `confused` answered `ok: true`, or when `maxTurns` model turns were taken. A refusal the
 * host makes itself (a second call in one model message, a turn with no call) is shown to the model in the same shape,
 * `{ ok: false, refused: NodeAgentRefusal }`, without asking `call`, and counts as a turn. For the cache the host sends `instructions`
 * as the system text, then the tool set, then `step` at the START of the first user message, before `volatile` and `input`.
 */
export interface NodeAgentLoop {
    /** What the calls are metered under: the node id and the agent's tag. */
    readonly purpose: string
    /** The agent's craft and the shop's policy values (L1 + L2): the same text for every step of the agent. Never the tool set. */
    readonly instructions: string
    /** The step (L3): its goal, then as JSON the tools it may call, the ones that must have succeeded, and the schema of its output. */
    readonly step: string
    /** The rules about what changes between two tries of the step (L4); absent when the turn carries none. */
    readonly volatile?: string | undefined
    /** What the agent works on, with what the turn knows that changes between tries (L4). */
    readonly input: unknown
    /** The agent's whole tool set in name order, each with its arguments' schema: what the model is shown, the same for every step. */
    readonly tools: ReadonlyArray<NodeAgentLoopTool>
    /** Pictures the agent should look at; none when absent. */
    readonly images?: ReadonlyArray<string> | undefined
    /** How hard a reasoning model should think on these turns; the host's default when absent. */
    readonly reasoning?: "off" | "low" | "medium" | "high" | undefined
    /** The most model turns the host may take. */
    readonly maxTurns: number
    /** Calls one tool for the agent through the runner's checks; answers the fact to show the model. Refused once the agent has ended. */
    readonly call: (name: string, args: unknown) => Promise<NodeAgentCallAnswer>
    /** Offers the step's output: taken only when every required call succeeded and it fits the step's schema. */
    readonly done: (output: unknown) => NodeAgentEndAnswer
    /** Says the agent cannot reach the goal without guessing: taken when it names a reason. */
    readonly confused: (confusion: NodeConfusion) => NodeAgentEndAnswer
}

/** What a host's loop came to, for the record: the runner reads the decision from its own closures. */
export interface NodeAgentLoopEnd {
    /** The model turns the host took. */
    readonly turns: number
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
