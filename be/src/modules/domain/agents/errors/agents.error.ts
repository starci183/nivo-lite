import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agents capability. */
export enum AgentsErrorCode {
    /** The installation does not exist in this workspace (or its module is unknown). */
    InstallationNotFound = "AGENTS_INSTALLATION_NOT_FOUND",
    /** No agent of this workspace has the requested id. */
    AgentNotFound = "AGENTS_AGENT_NOT_FOUND",
    /** Another agent of the workspace already uses the handle. */
    HandleTaken = "AGENTS_HANDLE_TAKEN",
    /** The insert answered no row: the agent was not written. */
    NotCreated = "AGENTS_NOT_CREATED",
}

/** How each agents code travels. */
export const AGENTS_ERROR_KINDS: Record<AgentsErrorCode, ErrorKind> = {
    [AgentsErrorCode.InstallationNotFound]: "not-found",
    [AgentsErrorCode.AgentNotFound]: "not-found",
    [AgentsErrorCode.HandleTaken]: "conflict",
    [AgentsErrorCode.NotCreated]: "internal",
}

/** The one error class of the agents capability. */
export class AgentsError extends DomainError<AgentsErrorCode> {}
