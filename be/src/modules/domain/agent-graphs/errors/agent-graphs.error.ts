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
    /** A new version whose params or refs are broken (`graphRefProblems`): an unknown field, a type mismatch, a ref that may not have run. */
    RefsRefused = "AGENT_GRAPHS_REFS_REFUSED",
    /** A draft whose flow names a model the vocabulary does not know, or a model on a node that calls no AI. */
    ModelRefused = "AGENT_GRAPHS_MODEL_REFUSED",
    /** A new version whose triggers, outcomes or end hand-offs break a workflow contract, or that would break a workflow that calls it. */
    ContractRefused = "AGENT_GRAPHS_CONTRACT_REFUSED",
    /** The change gives the agent more reach, and only the owner may publish that. */
    WidensNeedsOwner = "AGENT_GRAPHS_WIDENS_NEEDS_OWNER",
    /** The graph is not a graph the product can read. */
    DocumentInvalid = "AGENT_GRAPHS_DOCUMENT_INVALID",
    /** Only the owner or a manager of the workspace may read or change an agent graph. */
    Forbidden = "AGENT_GRAPHS_FORBIDDEN",
    /** The graph never decided this work item. */
    RunNotFound = "AGENT_GRAPHS_RUN_NOT_FOUND",
    /** The action the owner spoke of has no bands in the graph that a boundary could move. */
    BranchNotApplicable = "AGENT_GRAPHS_BRANCH_NOT_APPLICABLE",
    /** A stored record is not the shape its entity declares. */
    RecordUnreadable = "AGENT_GRAPHS_RECORD_UNREADABLE",
    /** The workflow is not a workflow of the agent, or the version is not a version of the workflow. */
    WorkflowNotFound = "AGENT_GRAPHS_WORKFLOW_NOT_FOUND",
    /** The workflow template, or the template version, does not exist. */
    TemplateNotFound = "AGENT_GRAPHS_TEMPLATE_NOT_FOUND",
    /** Someone published a version of the workflow after it was read. */
    WorkflowConflict = "AGENT_GRAPHS_WORKFLOW_CONFLICT",
    /** The workflow change is refused: its graph has problems, the status move or the template version is not allowed. */
    WorkflowRefused = "AGENT_GRAPHS_WORKFLOW_REFUSED",
}

/** How each agent-graphs code travels. */
export const AGENT_GRAPHS_ERROR_KINDS: Record<AgentGraphsErrorCode, ErrorKind> = {
    [AgentGraphsErrorCode.GraphNotFound]: "not-found",
    [AgentGraphsErrorCode.VersionNotFound]: "not-found",
    [AgentGraphsErrorCode.ProposalNotFound]: "not-found",
    [AgentGraphsErrorCode.DraftConflict]: "conflict",
    [AgentGraphsErrorCode.PublishRefused]: "invalid",
    [AgentGraphsErrorCode.RefsRefused]: "invalid",
    [AgentGraphsErrorCode.ModelRefused]: "invalid",
    [AgentGraphsErrorCode.ContractRefused]: "invalid",
    [AgentGraphsErrorCode.WidensNeedsOwner]: "forbidden",
    [AgentGraphsErrorCode.DocumentInvalid]: "internal",
    [AgentGraphsErrorCode.Forbidden]: "forbidden",
    [AgentGraphsErrorCode.RunNotFound]: "not-found",
    [AgentGraphsErrorCode.BranchNotApplicable]: "invalid",
    [AgentGraphsErrorCode.RecordUnreadable]: "internal",
    [AgentGraphsErrorCode.WorkflowNotFound]: "not-found",
    [AgentGraphsErrorCode.TemplateNotFound]: "not-found",
    [AgentGraphsErrorCode.WorkflowConflict]: "conflict",
    [AgentGraphsErrorCode.WorkflowRefused]: "invalid",
}

/** The one error class of the agent-graphs capability. */
export class AgentGraphsError extends DomainError<AgentGraphsErrorCode> {}
