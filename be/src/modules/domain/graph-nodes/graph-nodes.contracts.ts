import type {
    EffectCall,
    NodeAgentLoop,
    NodeAgentLoopEnd,
    NodeHostPorts,
    NodeModel,
    NodeModelRequest,
    NodeQuery,
    SubjectRef,
    TurnRef,
} from "@nivo-lite/agent-sdk/node"
import type { RightScope, RightsGrant } from "@nivo-lite/agent-sdk/rights"
import type { Locale } from "@modules/platform/i18n"
import type { NodeToolApproval, NodeToolArgs, NodeToolCall, RunOrigin } from "./node-run-token.contracts"

export type { NodeInstall } from "@nivo-lite/agent-sdk/node"

/** The turn a node runs in, as the host's ports read it: the SDK turn, the conversation it serves and the language it writes in. */
export interface NodeTurn extends TurnRef {
    /** The customer conversation the run serves, or null. */
    readonly conversationId: string | null
    /** The language of the turn. */
    readonly locale: Locale
    /** Who the run acts for; a run that does not say is the system's. */
    readonly origin?: RunOrigin
    /** The member behind the turn, when a person is. */
    readonly memberId?: string | null
    /** The agent that handed its conversation to this run (the wake was a hand-off tag), or null when the run was not woken by one. */
    readonly handedOffBy?: string | null
}

/** A row a data port answers: only the fields asked. */
export interface NodeRow {
    /** One field by name. */
    readonly [field: string]: unknown
}

/** The rows a data port answers. */
export type NodeRows = ReadonlyArray<NodeRow>

/** The payload of one effect, parsed by the effect's own schema before its executor runs. */
export interface NodeEffectPayload {
    /** One member by name. */
    readonly [member: string]: unknown
}

/** A structured model answer, before the node's schema parses it. */
export interface NodeJsonAnswer {
    /** One member by name. */
    readonly [member: string]: unknown
}

/** The schema a node's structured model call is parsed with. */
export type NodeJsonSchema = Parameters<NodeModel["json"]>[0]

/**
 * The port of one data kind, which the module that owns the records registers. The host has already checked the rights; a `turn` read
 * keeps to the records the turn's subject or conversation is linked to, a `workspace` read reaches the workspace.
 */
export interface NodeDataPort {
    /** The data kind it serves. */
    readonly kind: string
    /** Reads the rows of the query, cut to its fields. */
    read(turn: NodeTurn, query: NodeQuery, scope: RightScope): Promise<NodeRows>
    /** Writes one record; a kind without it refuses every write. */
    write?(turn: NodeTurn, record: NodeRow): Promise<SubjectRef>
}

/** The act of one effect call: it runs the effect and answers the subject it touched. */
export type EffectAct = () => Promise<SubjectRef>

/** The executor of one effect, or undefined when no module performs it. */
export type OptionalNodeEffectExecutor = NodeEffectExecutor | undefined

/** The executor of one effect, which the module that acts registers. It runs once per call; the host keeps the ledger. */
export interface NodeEffectExecutor {
    /** The effect id it runs. */
    readonly effect: string
    /** Acts and answers the subject it touched. */
    execute(turn: NodeTurn, payload: NodeEffectPayload, call: EffectCall): Promise<SubjectRef>
}

/**
 * Finds the record a turn is about when its trigger named none, for example the customer of the conversation it serves. A module that
 * owns such records registers it; the host asks each in turn and keeps the first answer.
 */
export interface NodeSubjectResolver {
    /** The subject of the turn, or null when this resolver knows none. */
    subjectOf(turn: NodeTurn): Promise<SubjectRef | null>
}

/** The effects a node step ran, to undo when its run fails before a pivot. */
export interface NodeUndoInput {
    /** The turn the node ran in. */
    readonly turn: NodeTurn
    /** The effects it ran, in order, with the subjects the ledger kept. */
    readonly done: ReadonlyArray<{ readonly id: string; readonly subject: SubjectRef }>
    /** The run step's idempotency key. */
    readonly key: string
}

/** Who and what language a node's model call is for. */
export interface NodeModelScope {
    /** The workspace whose allowance the call is metered against. */
    readonly workspaceId: string
    /** The language the answer is written in. */
    readonly locale: Locale
    /** The model the node's calls are declared with (`node-model.policy.ts`); the door picks each try's model from it. */
    readonly model?: NodeDeclaredModel | undefined
}

/** The model a node's calls are declared with, and where the declaration came from. */
export interface NodeDeclaredModel {
    /** `auto`, or a model id. */
    readonly model: string
    /** The step's weight as blocks-core declares it; Auto reads it. */
    readonly weight: "light" | "heavy"
    /** `node`: the graph's node names it (the shop's choice); `declared`: blocks-core's table; `default`: neither. */
    readonly source: "node" | "declared" | "default"
}

/** The agents' metered model path, as the host calls it for a node: the app root binds the prompt library to it. */
export interface NodeModelDoor {
    /** A free-text answer. */
    nodeText(scope: NodeModelScope, ask: NodeModelRequest): Promise<string>
    /** A structured answer the schema asks for. */
    nodeJson(scope: NodeModelScope, ask: NodeModelRequest, schema: NodeJsonSchema): Promise<NodeJsonAnswer>
    /**
     * The model of one step's agent for the host's own loop: an object the loop takes turns on (its tries, deadlines and metering are
     * the door's). The host hands it to the loop as it is and reads nothing of it. Absent on a door that serves no such loop.
     */
    nodeAgentTurns?(scope: NodeModelScope, ask: NodeAgentTurnsAsk): unknown
    /**
     * The pictures of a model call as the data addresses a model request carries (unreadable ones left out), so the host's loop is
     * handed pictures it resolves nothing of. Absent on a door that inlines none.
     */
    nodeImages?(scope: NodeModelScope, images: ReadonlyArray<string>): Promise<ReadonlyArray<string>>
}

/** What the turns of one step's agent are asked with. */
export interface NodeAgentTurnsAsk {
    /** What the calls are metered under: the node id and the agent's tag. */
    readonly purpose: string
    /** How hard a reasoning model should think on these turns; the door's default when absent. */
    readonly reasoning?: NodeAgentLoop["reasoning"]
}

/**
 * Keeps the answer of one model turn of the host's loop with the run of the step, so a step that starts again from its first line is
 * handed the same answer instead of asking the model anew. `act` asks the model and resolves to plain JSON.
 */
export type NodeTurnRecord = (call: string, act: () => Promise<unknown>) => Promise<unknown>

/** The host's own loop for a step's agent (native tool calling): the port the app binds to the loop of its model integration. */
export interface NodeAgentLoops {
    /** Takes the turns of one agent on the model, answering every call through the runner's own closures of `loop`. */
    run(
        loop: NodeAgentLoop,
        model: unknown,
        options?: { readonly record?: NodeTurnRecord | undefined },
    ): Promise<NodeAgentLoopEnd>
}

/** The once-per-key ledger of effects, as another capability uses it: the act runs once per key in a workspace, a replay answers what it kept. */
export interface EffectOnce {
    /** Runs the act once per key and answers the subject the first run touched. */
    once(workspaceId: string, effect: string, call: EffectCall, act: EffectAct): Promise<SubjectRef>
}

/** The door every node tool call goes through: the NIVO MCP, resolved to the provider the workspace connected. */
export interface NodeToolDoor {
    /** Calls one tool for the run its token names, under the call's replay key. */
    call(call: NodeToolCall): Promise<unknown>
    /**
     * The right of the run's agent to perform an effect that is a right on a provider the workspace connected (a payment QR), judged
     * exactly as the same tool is on the gateway: null when the effect may run (or is no provider right), the refusal fact the effect
     * answers instead of running, or the typed approval error thrown when the right asks a person first.
     */
    effectRight?(call: NodeEffectRightCall): Promise<SubjectRef | null>
    /**
     * The refusal an effect answers instead of acting because it would repeat what the same step already did for its stop (one line
     * to a customer per stop), or null when it may act. It is asked only for a call the effect ledger holds no answer for, just before
     * the executor runs, so a call the step already made is still replayed as it was.
     */
    repeatGuard?(call: NodeRepeatGuardCall): Promise<SubjectRef | null>
}

/** One effect a step is about to perform for real, as the door is asked whether it repeats the step's earlier attempt. */
export interface NodeRepeatGuardCall {
    /** The effect id. */
    readonly effect: string
    /** The payload of the call. */
    readonly payload: NodeToolArgs
    /** The turn the step runs in: its workspace, and the founder's answers to the step's earlier report, when it carries any. */
    readonly turn: NodeTurn
    /** The run step's key (`<run>:<step>`), the same on every attempt of the step. */
    readonly step: string
    /** When the present attempt of the step began (ISO text): what the step did before it belongs to an earlier attempt. */
    readonly startedAt: string
}

/** One effect of a node whose right the door is asked for. */
export interface NodeEffectRightCall {
    /** The run token the host minted. */
    readonly token: string
    /** The effect id. */
    readonly effect: string
    /** The payload of the call. */
    readonly payload: NodeToolArgs
    /** The person's approval this call replays, or null. */
    readonly approval: NodeToolApproval | null
}

/** One run of an installed node. */
export interface NodeRunInput {
    /** The node id. */
    readonly nodeId: string
    /** The settings the graph gave it. */
    readonly params: unknown
    /** Its input, resolved from the bindings. */
    readonly input: unknown
    /** The turn. */
    readonly turn: NodeTurn
    /** What the agent holds. */
    readonly grant: RightsGrant
    /** The run step's idempotency key. */
    readonly key: string
    /**
     * The model the graph's node names (`GraphSpecNode.model`: `auto` or a model id, the shop's choice in the node drawer); absent,
     * blocks-core's declaration for the node's step, else the default model.
     */
    readonly model?: string | undefined
    /** A person's approval of a tool call the node makes, carried into the run of the node it was asked for. */
    readonly approval?: NodeToolApproval
    /**
     * Wraps the ports of this run before the node runs on them: the hook of an engine that keeps the answers of a step's model, effect
     * and tool calls and hands them back when the step is run again from its first line (a thread engine's replay), so a call already
     * answered is not made again. The wrapper receives the host's own ports (every right, guard and ledger already inside them) and
     * must answer ports of the same contract. Absent, the node runs on the host's ports as they are.
     */
    readonly replay?: NodePortsWrap
    /**
     * Keeps each model turn of the host's own agent loop with the run of the step (the same engine that passes `replay`): on a step
     * that starts again a turn already answered is not asked again. Absent, every turn asks the model.
     */
    readonly record?: NodeTurnRecord
}

/** Wraps the ports of one node run; what it answers is what the node runs on. */
export type NodePortsWrap = (ports: NodeHostPorts) => NodeHostPorts
