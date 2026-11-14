import type {
    EffectCall,
    NodeAgentLoop,
    NodeAgentLoopEnd,
    NodeGrant,
    NodeHostPorts,
    NodeModel,
    NodeModelRequest,
    NodeQuery,
    ReadScope,
    SubjectRef,
    TurnRef,
} from "@nivo-lite/agent-sdk/node"
import type { PluginNodeModel } from "@nivo-lite/agent-sdk/installation"
import type { Locale } from "@modules/platform/i18n"
import type {
    NodeStepRef,
    NodeToolAccount,
    NodeToolApproval,
    NodeToolArgs,
    NodeToolCall,
    RunOrigin,
} from "./node-run-token.contracts"

export type { NodeInstall } from "@nivo-lite/agent-sdk/node"

/** The turn a node runs in, as the host's ports read it: the SDK turn, the conversation it serves and the language it writes in. */
export interface NodeTurn extends TurnRef {
    /** The customer conversation the run serves, or null. */
    readonly conversationId: string | null
    /**
     * The contact (the engine's person) the run serves, from its trigger (`trigger.contactId`): absent or null for a run about nobody.
     * The engine's own rows (memory, holds, stops, the run token) key a person by it; `subject` stays the record a module resolved.
     */
    readonly contactId?: string | null | undefined
    /** The language of the turn. */
    readonly locale: Locale
    /** Who the run acts for; a run that does not say is the system's. */
    readonly origin?: RunOrigin
    /** The member behind the turn, when a person is. */
    readonly memberId?: string | null
    /** The agent that handed its conversation to this run (the wake was a hand-off tag), or null when the run was not woken by one. */
    readonly handedOffBy?: string | null
    /**
     * The workflow step the turn's call is made in. Only the host sets it, and only on the turn it hands an effect's executor (the node
     * itself and its model never see it): an executor that judges a right on a connected account names its step with it.
     */
    readonly step?: NodeStepRef | undefined
    /**
     * The connected account the runner handed the effect the turn's call is made for, when it acts on one. Only the runner sets it, on
     * the turn it hands an effect's executor: an executor that acts on an account prefers it and keeps its own pick when it is absent.
     */
    readonly account?: NodeToolVia | undefined
    /**
     * The person who approved exactly this call (the approval's fingerprint is the call's own), when it replays an approval. Only the
     * engine sets it (the runner, the host, the effect tools of the gateway from its own approved replay), on the turn it hands an
     * effect's executor: never anything the arguments say. An executor that holds a limit a person may lift (the order confirm above
     * the owner threshold) reads it; absent, nobody approved the call.
     */
    readonly approvedBy?: string | undefined
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
 * The port of one data kind, which the module that owns the records registers. The node's query states the scope; a `turn` read
 * keeps to the records the turn's subject or conversation is linked to, a `workspace` read reaches the workspace.
 */
export interface NodeDataPort {
    /** The data kind it serves. */
    readonly kind: string
    /** Reads the rows of the query, cut to its fields. */
    read(turn: NodeTurn, query: NodeQuery, scope: ReadScope): Promise<NodeRows>
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
    /**
     * Optional, side-effect-free: the refusal `execute` would answer for these arguments right now, or null when it would act. The tool
     * door asks it BEFORE it raises a person's approval, so nobody is asked to approve a call that cannot go; the same rules still run in
     * `execute`, because state can change between asking and approving. It writes nothing and calls no provider.
     */
    refusalFor?(turn: NodeTurn, payload: NodeEffectPayload, call: EffectCall): Promise<SubjectRef | null>
}

/**
 * Finds the record a turn is about when its trigger named none, for example the customer of the conversation it serves. A module that
 * owns such records registers it; the host asks each in turn and keeps the first answer.
 */
export interface NodeSubjectResolver {
    /** The subject of the turn, or null when this resolver knows none. */
    subjectOf(turn: NodeTurn): Promise<SubjectRef | null>
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
    /** The most completion tokens one call of the step may produce, as blocks-core declares it for the step; absent: the app's cap. */
    readonly maxOutputTokens?: number | undefined
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
export type NodeTurnRecord = (call: string, act: NodeTurnAct) => Promise<unknown>

/** Asks the model for one turn of the host's loop and resolves to plain JSON. */
export type NodeTurnAct = () => Promise<unknown>

/** How the host's loop keeps its turns with the run of the step. */
export interface NodeAgentLoopOptions {
    /** The keeper of each model turn, or absent when the step is not replayed. */
    readonly record?: NodeTurnRecord | undefined
}

/** The subject an effect answers instead of running, or null when it may run. */
export type OptionalSubjectRef = SubjectRef | null

/** The host's own loop for a step's agent (native tool calling): the port the app binds to the loop of its model integration. */
export interface NodeAgentLoops {
    /** Takes the turns of one agent on the model, answering every call through the runner's own closures of `loop`. */
    run(
        loop: NodeAgentLoop,
        model: unknown,
        options?: NodeAgentLoopOptions,
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
    effectRight?(call: NodeEffectRightCall): Promise<OptionalSubjectRef>
    /**
     * The ONE runner of a node's calls: an effect of `context.effect` and a tool of `context.tools.call` both go through it (rights,
     * the run's pin, the step's receipts, the once-per-key ledger, the audit line), under the same call key for the same id and
     * arguments. A door that has none leaves the host on its own effect ledger and `call`.
     */
    run?: ((call: NodeToolRun) => Promise<NodeToolAnswer>) | undefined
}

/** One attempt of a run step: the step's key, and when this attempt began. */
export interface NodeRunAttempt {
    /** The run step's key (`<run>:<step>`), the same on every attempt of the step. */
    readonly step: string
    /** When the present attempt of the step began (ISO text). */
    readonly startedAt: string
}

/** One effect a node performs through `context.effect`, as the runner is asked to run it. */
export interface NodeEffectRun {
    /** The road: an effect. */
    readonly road: "effect"
    /** The run token the host minted. */
    readonly token: string
    /** The effect id. */
    readonly effect: string
    /** The payload, parsed by the effect's own schema. */
    readonly payload: NodeToolArgs
    /** The call's key and its business key (`onceBy`, today's `dedupeKey`). */
    readonly call: EffectCall
    /** The person's approval this call replays, or null. */
    readonly approval: NodeToolApproval | null
    /** The turn the node runs in. */
    readonly turn: NodeTurn
    /** The workflow step the engine named, when it named one; the executor is handed the turn with it. */
    readonly workflowStep?: NodeStepRef | undefined
    /** The attempt of the step the call is made in. */
    readonly attempt: NodeRunAttempt
    /**
     * `answer` on the TEMPLATE road (as `NodeToolCall.refusals`): only a business refusal comes back as the refusal fact; a refusal of
     * the agent's rights or of the setup (`tool_off`, `not_attached`, `ability_off`, `no_default_account`, `notice_run`) freezes the step.
     * Absent (the `defineNode` road): every refusal of the right comes back as the refusal fact, as before.
     */
    readonly refusals?: "answer" | undefined
}

/** One tool a node calls through `context.tools.call`, as the runner is asked to run it. */
export interface NodeToolCallRun extends NodeToolCall {
    /** The road: a tool. */
    readonly road: "tool"
    /** The turn the node runs in: whose agent calls, in which workspace. */
    readonly turn: NodeTurn
    /** The workflow step the engine named, when it named one: the node whose bound accounts the call may act on. */
    readonly workflowStep?: NodeStepRef | undefined
}

/** One call the runner is asked to run. */
export type NodeToolRun = NodeEffectRun | NodeToolCallRun

/** The account a call ran on: its provider and its connection. */
export interface NodeToolVia {
    /** The provider key. */
    readonly provider: string
    /** The connection. */
    readonly connectionId: string
}

/** What the runner answers: the subject of an effect, or the value of a tool; `via` names the account it ran on, when one. */
export type NodeToolAnswer =
    | { readonly road: "effect"; readonly subject: SubjectRef; readonly via?: NodeToolVia | undefined }
    | { readonly road: "tool"; readonly value: unknown; readonly via?: NodeToolVia | undefined }

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
    /** The connected account the runner handed the effect, when it acts on one: it is judged on that account alone. */
    readonly account?: NodeToolAccount | undefined
    /** `answer` on the template road: a refusal of the right is then thrown (`GRAPH_NODES_TOOL_NOT_GRANTED`), never answered. */
    readonly refusals?: "answer" | undefined
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
    /** The NIVO MCP tools the run may call, by name. */
    readonly grant: NodeGrant
    /** The run step's idempotency key. */
    readonly key: string
    /**
     * The workflow step this run is: the node's key in its graph, the pinned version and its workflow. An engine that runs a pinned
     * version passes it; the host signs it into every run token of the node and names it to the effect executors, so the audit and the
     * rights know which step called. Absent, the calls of the run name no step. It changes nothing a call may do.
     */
    readonly step?: NodeStepRef | undefined
    /**
     * The model the graph's node names (`GraphSpecNode.model`: `auto` or a model id, the shop's choice in the node drawer); absent,
     * blocks-core's declaration for the node's step, else the default model.
     */
    readonly model?: string | undefined
    /** A person's approval of a tool call the node makes, carried into the run of the node it was asked for. */
    readonly approval?: NodeToolApproval
    /**
     * Whether a person declined the approval of exactly the call of this fingerprint in this step (the decision is kept where the
     * approvals live: the owner's item and the step's approval stop). A TEMPLATE node's call that asks again for a declined fingerprint
     * is answered `{ ok: false, refusal: "declined" }` and asks nobody; a `defineNode` node never reads it. Absent: nothing was declined.
     */
    readonly declined?: ((fingerprint: string) => Promise<boolean>) | undefined
    /**
     * The approval a person gave in this step to exactly the call of this fingerprint, or null (read where the approvals live). A call
     * of the node that asks for an approval of a fingerprint a person already approved in this step (the replay of an approved write,
     * LangGraph re-running the node on resume) runs as approved: its receipt answers it, nothing is asked again. Absent: none.
     */
    readonly approved?: ((fingerprint: string) => Promise<NodeToolApproval | null>) | undefined
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
    /**
     * Inside a for-each body: the item this iteration works on, by its identity (the loop's `itemKey` member, or its index as text)
     * and its position from 0; a template node reads it as `ctx.run.item`. Absent outside every loop.
     */
    readonly item?: { readonly key: string; readonly index: number } | undefined
}

/** Wraps the ports of one node run; what it answers is what the node runs on. */
export type NodePortsWrap = (ports: NodeHostPorts) => NodeHostPorts

/** The model the graph's node names (the shop's choice), or undefined when it names none. */
export type OptionalNodeModelName = string | undefined

/** The kinds of work a node's calls may be booked as instead of plain node work (`chat_turn`: an answer to a person in the team chat). */
export type NodeWorkKind = NonNullable<PluginNodeModel["work"]>
