import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agents capability. */
export enum AgentsErrorCode {
    /** A text generation did not produce text; the reason and the sentence to show ride in the params. */
    GenerationFailed = "AGENTS_GENERATION_FAILED",
    /** The installation does not exist in this workspace (or its module is unknown). */
    InstallationNotFound = "AGENTS_INSTALLATION_NOT_FOUND",
    /** No agent of this workspace has the requested id. */
    AgentNotFound = "AGENTS_AGENT_NOT_FOUND",
    /** Another agent of the workspace already uses the handle. */
    HandleTaken = "AGENTS_HANDLE_TAKEN",
    /** The agent or the connection of a binding is not in the workspace. */
    BindingTargetNotFound = "AGENTS_BINDING_TARGET_NOT_FOUND",
    /** The agent workspaces cannot be written: no config directory is set. */
    WorkspaceUnavailable = "AGENTS_WORKSPACE_UNAVAILABLE",
    /** The insert answered no row: the agent was not written. */
    NotCreated = "AGENTS_NOT_CREATED",
}

/** How each agents code travels. */
export const AGENTS_ERROR_KINDS: Record<AgentsErrorCode, ErrorKind> = {
    [AgentsErrorCode.GenerationFailed]: "unavailable",
    [AgentsErrorCode.InstallationNotFound]: "not-found",
    [AgentsErrorCode.AgentNotFound]: "not-found",
    [AgentsErrorCode.HandleTaken]: "conflict",
    [AgentsErrorCode.BindingTargetNotFound]: "not-found",
    [AgentsErrorCode.WorkspaceUnavailable]: "unavailable",
    [AgentsErrorCode.NotCreated]: "internal",
}

/** The one error class of the agents capability. */
export class AgentsError extends DomainError<AgentsErrorCode> {}
