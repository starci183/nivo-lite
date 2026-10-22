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
    /** The app registered the setup mode without the knowledge lens, so the dashboard and the bundle cannot read knowledge here. */
    KnowledgeUnbound = "AGENTS_KNOWLEDGE_UNBOUND",
    /** Nobody in the chain (owner, fallback, workspace owner) is an active member, so the agent's work has nowhere to go. */
    OwnerUnavailable = "AGENTS_OWNER_UNAVAILABLE",
    /** An ownership change names a member, room, role or agent that does not belong to the workspace. */
    OwnershipInvalid = "AGENTS_OWNERSHIP_INVALID",
}

/** How each agents code travels. */
export const AGENTS_ERROR_KINDS: Record<AgentsErrorCode, ErrorKind> = {
    [AgentsErrorCode.InstallationNotFound]: "not-found",
    [AgentsErrorCode.AgentNotFound]: "not-found",
    [AgentsErrorCode.HandleTaken]: "conflict",
    [AgentsErrorCode.NotCreated]: "internal",
    [AgentsErrorCode.KnowledgeUnbound]: "internal",
    [AgentsErrorCode.OwnerUnavailable]: "unavailable",
    [AgentsErrorCode.OwnershipInvalid]: "invalid",
}

/** The one error class of the agents capability. */
export class AgentsError extends DomainError<AgentsErrorCode> {}
