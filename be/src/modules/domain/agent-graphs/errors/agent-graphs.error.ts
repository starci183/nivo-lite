import { DomainError, type ErrorKind } from "@modules/platform/errors"

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
    /** The agent's module belongs to a private plugin the workspace may no longer use (its enterprise identifier does not match). */
    ModuleClosed = "AGENT_GRAPHS_MODULE_CLOSED",
    /** A new version whose triggers, outcomes or end hand-offs break a workflow contract, or that would break a workflow that calls it. */
    ContractRefused = "AGENT_GRAPHS_CONTRACT_REFUSED",
    /** The change gives the agent more reach, and only the owner may publish that. */
    WidensNeedsOwner = "AGENT_GRAPHS_WIDENS_NEEDS_OWNER",
    /**
     * The version asks for operations on connected accounts beyond what its workflow holds (a new operation, or `auto` where it holds
     * `ask`): it activates only when the owner agrees to every one of them. `params.rights` lists them as JSON, each with the
     * title of the step that asks (`stepTitle`, in the owner's two languages; null for a step no installed node is).
     */
    RightsNeedOwner = "AGENT_GRAPHS_RIGHTS_NEED_OWNER",
    /** The graph is not a graph the product can read. */
    DocumentInvalid = "AGENT_GRAPHS_DOCUMENT_INVALID",
    /** Only the owner or a manager of the workspace may read or change an agent graph. */
    Forbidden = "AGENT_GRAPHS_FORBIDDEN",
    /** The graph never decided this work item. */
    RunNotFound = "AGENT_GRAPHS_RUN_NOT_FOUND",
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
    /** A workflow wake reached the flow before the thread engine registered: the app composed no engine to run it. */
    EngineMissing = "AGENT_GRAPHS_ENGINE_MISSING",
    /**
     * A pick of a trigger's source names a workflow not of the agent, a stream its attached accounts do not contest for that purpose, or
     * an account that does not read that stream (owner key `triggerOneSource2026_11_12`): nothing is written.
     */
    TriggerPickRefused = "AGENT_GRAPHS_TRIGGER_PICK_REFUSED",
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
    [AgentGraphsErrorCode.ModuleClosed]: "forbidden",
    [AgentGraphsErrorCode.ContractRefused]: "invalid",
    [AgentGraphsErrorCode.WidensNeedsOwner]: "forbidden",
    [AgentGraphsErrorCode.RightsNeedOwner]: "forbidden",
    [AgentGraphsErrorCode.DocumentInvalid]: "internal",
    [AgentGraphsErrorCode.Forbidden]: "forbidden",
    [AgentGraphsErrorCode.RunNotFound]: "not-found",
    [AgentGraphsErrorCode.RecordUnreadable]: "internal",
    [AgentGraphsErrorCode.WorkflowNotFound]: "not-found",
    [AgentGraphsErrorCode.TemplateNotFound]: "not-found",
    [AgentGraphsErrorCode.WorkflowConflict]: "conflict",
    [AgentGraphsErrorCode.WorkflowRefused]: "invalid",
    [AgentGraphsErrorCode.EngineMissing]: "internal",
    [AgentGraphsErrorCode.TriggerPickRefused]: "invalid",
}

/** The one error class of the agent-graphs capability. */
export class AgentGraphsError extends DomainError<AgentGraphsErrorCode> {}
