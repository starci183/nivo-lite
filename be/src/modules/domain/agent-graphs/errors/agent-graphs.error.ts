import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-graphs capability. */
export enum AgentGraphsErrorCode {
    /** The agent has no graph yet. */
    GraphNotFound = "AGENT_GRAPHS_GRAPH_NOT_FOUND",
    /** The version is not a version of the agent. */
    VersionNotFound = "AGENT_GRAPHS_VERSION_NOT_FOUND",
    /** The proposal is not a proposal of the agent. */
    ProposalNotFound = "AGENT_GRAPHS_PROPOSAL_NOT_FOUND",
    /** Someone saved the draft after it was read. */
    DraftConflict = "AGENT_GRAPHS_DRAFT_CONFLICT",
    /** The graph still has problems the owner must fix before it is published. */
    PublishRefused = "AGENT_GRAPHS_PUBLISH_REFUSED",
    /** The change gives the agent more reach, and only the owner may publish that. */
    WidensNeedsOwner = "AGENT_GRAPHS_WIDENS_NEEDS_OWNER",
    /** The graph is not a graph the product can read. */
    DocumentInvalid = "AGENT_GRAPHS_DOCUMENT_INVALID",
    /** Only the owner or a manager of the workspace may read or change an agent graph. */
    Forbidden = "AGENT_GRAPHS_FORBIDDEN",
}

/** How each agent-graphs code travels. */
export const AGENT_GRAPHS_ERROR_KINDS: Record<AgentGraphsErrorCode, ErrorKind> = {
    [AgentGraphsErrorCode.GraphNotFound]: "not-found",
    [AgentGraphsErrorCode.VersionNotFound]: "not-found",
    [AgentGraphsErrorCode.ProposalNotFound]: "not-found",
    [AgentGraphsErrorCode.DraftConflict]: "conflict",
    [AgentGraphsErrorCode.PublishRefused]: "invalid",
    [AgentGraphsErrorCode.WidensNeedsOwner]: "forbidden",
    [AgentGraphsErrorCode.DocumentInvalid]: "internal",
    [AgentGraphsErrorCode.Forbidden]: "forbidden",
}

/** The one error class of the agent-graphs capability. */
export class AgentGraphsError extends DomainError<AgentGraphsErrorCode> {}
