import type { EffectCall, NodeModel, NodeModelRequest, NodeQuery, SubjectRef, TurnRef } from "@nivo-lite/agent-sdk/node"
import type { RightScope, RightsGrant } from "@nivo-lite/agent-sdk/rights"
import type { Locale } from "@modules/platform/i18n"
import type { NodeToolApproval, NodeToolCall, RunOrigin } from "./node-run-token.contracts"

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
}

/** The agents' metered model path, as the host calls it for a node: the app root binds the prompt library to it. */
export interface NodeModelDoor {
    /** A free-text answer. */
    nodeText(scope: NodeModelScope, ask: NodeModelRequest): Promise<string>
    /** A structured answer the schema asks for. */
    nodeJson(scope: NodeModelScope, ask: NodeModelRequest, schema: NodeJsonSchema): Promise<NodeJsonAnswer>
}

/** The door every node tool call goes through: the NIVO MCP, resolved to the provider the workspace connected. */
export interface NodeToolDoor {
    /** Calls one tool for the run its token names, under the call's replay key. */
    call(call: NodeToolCall): Promise<unknown>
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
    /** A person's approval of a tool call the node makes, carried into the run of the node it was asked for. */
    readonly approval?: NodeToolApproval
}
