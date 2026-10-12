import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-connections capability. */
export enum AgentConnectionsErrorCode {
    /** The agent or the connection of a binding is not in the workspace. */
    TargetNotFound = "AGENT_CONNECTIONS_TARGET_NOT_FOUND",
}

/** How each agent-connections code travels. */
export const AGENT_CONNECTIONS_ERROR_KINDS: Record<AgentConnectionsErrorCode, ErrorKind> = {
    [AgentConnectionsErrorCode.TargetNotFound]: "not-found",
}

/** The one error class of the agent-connections capability. */
export class AgentConnectionsError extends DomainError<AgentConnectionsErrorCode> {}
