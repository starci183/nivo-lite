import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the graph-nodes capability. */
export enum GraphNodesErrorCode {
    /** A graph names a node the app did not install. */
    NodeUnknown = "GRAPH_NODES_NODE_UNKNOWN",
    /** Two modules registered a port or an executor for the same kind. */
    PortDuplicate = "GRAPH_NODES_PORT_DUPLICATE",
    /** A node read or wrote a kind no module serves. */
    PortMissing = "GRAPH_NODES_PORT_MISSING",
    /** A node ran an effect no module executes. */
    ExecutorMissing = "GRAPH_NODES_EXECUTOR_MISSING",
    /** A node called a tool while no NIVO MCP door is bound. */
    ToolDoorMissing = "GRAPH_NODES_TOOL_DOOR_MISSING",
    /** A node called a capability tool the workspace has no connected provider for: the node turns it into a connect work item. */
    ToolNotConnected = "GRAPH_NODES_TOOL_NOT_CONNECTED",
    /** The agent holds no gateway grant for the tool (or no data right over what it reads): only the owner can grant it, so it is not retried. */
    ToolNotGranted = "GRAPH_NODES_TOOL_NOT_GRANTED",
    /** The provider refused the workspace's connection itself (a scope never given, a 403): only the owner can cure it, so it is not retried. */
    ToolConnectionRefused = "GRAPH_NODES_TOOL_CONNECTION_REFUSED",
    /** A tool call needs a person's approval first: the step waits for it (the tool and the call's fingerprint ride in the params). */
    ToolApprovalRequired = "GRAPH_NODES_TOOL_APPROVAL_REQUIRED",
    /** A tool call came without a valid run token: nothing the host minted stands behind it. */
    ToolTokenInvalid = "GRAPH_NODES_TOOL_TOKEN_INVALID",
    /** The `AGENT_LOOP` flag is not `prebuilt:<node ids>`, names a node that is not installed, or names nodes where no loop is bound. */
    AgentLoopFlagInvalid = "GRAPH_NODES_AGENT_LOOP_FLAG_INVALID",
    /** The NIVO MCP door refused or failed a node tool call (the reason rides in the params). */
    ToolFailed = "GRAPH_NODES_TOOL_FAILED",
    /** An effect ran but its ledger record could not be written or found, so a repeat could not tell it ran. */
    EffectNotRecorded = "GRAPH_NODES_EFFECT_NOT_RECORDED",
    /** A call's ledger key is held by another effect: nothing acts, since the kept result is not this effect's to answer. */
    EffectKeyTaken = "GRAPH_NODES_EFFECT_KEY_TAKEN",
}

/** How each graph-nodes code travels. */
export const GRAPH_NODES_ERROR_KINDS: Record<GraphNodesErrorCode, ErrorKind> = {
    [GraphNodesErrorCode.NodeUnknown]: "not-found",
    [GraphNodesErrorCode.PortDuplicate]: "internal",
    [GraphNodesErrorCode.PortMissing]: "internal",
    [GraphNodesErrorCode.ExecutorMissing]: "internal",
    [GraphNodesErrorCode.ToolDoorMissing]: "internal",
    [GraphNodesErrorCode.ToolNotConnected]: "not-found",
    [GraphNodesErrorCode.ToolNotGranted]: "forbidden",
    [GraphNodesErrorCode.ToolConnectionRefused]: "forbidden",
    [GraphNodesErrorCode.ToolApprovalRequired]: "forbidden",
    [GraphNodesErrorCode.ToolTokenInvalid]: "forbidden",
    [GraphNodesErrorCode.AgentLoopFlagInvalid]: "internal",
    [GraphNodesErrorCode.ToolFailed]: "unavailable",
    [GraphNodesErrorCode.EffectNotRecorded]: "internal",
    [GraphNodesErrorCode.EffectKeyTaken]: "internal",
}

/** The one error class of the graph-nodes capability. */
export class GraphNodesError extends DomainError<GraphNodesErrorCode> {}

/**
 * The codes of an effect call whose outcome nobody knows (a tool call sent with no answer, a delivery with no clear receipt, a decision
 * with no known person). They are the codes of other capabilities (`agent-runs` `TOOL_OUTCOME_UNKNOWN`, `DECISION_ACTOR_UNKNOWN`,
 * `customer-send` `CHAT_DELIVERY_UNKNOWN`), kept as they are because both engines hand exactly these to a person.
 */
export enum EffectOutcomeUnknownCode {
    /** A tool call was sent and no answer came back. */
    Tool = "tool_outcome_unknown",
    /** A message was handed to the channel with no clear receipt. */
    Delivery = "delivery_outcome_unknown",
    /** A decision was taken with no known person behind it. */
    DecisionActor = "decision_actor_unknown",
}

/** The codes of `EffectOutcomeUnknownCode`, for a lookup by a stored string. */
const OUTCOME_UNKNOWN_VALUES: ReadonlySet<string> = new Set(Object.values(EffectOutcomeUnknownCode))

/** True for a code of `EffectOutcomeUnknownCode`. */
export const isOutcomeUnknownCode = (code: unknown): code is EffectOutcomeUnknownCode =>
    typeof code === "string" && OUTCOME_UNKNOWN_VALUES.has(code)

/**
 * What a call the effect ledger kept as outcome-unknown answers again: the code its act ended with the first time, so either engine
 * hands it to a person as it did then, and no machine makes the call again.
 */
export class EffectOutcomeUnknownError extends DomainError<EffectOutcomeUnknownCode> {}
