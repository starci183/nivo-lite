import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent profile capability. */
export enum AgentProfileErrorCode {
    /** The agent is not in this workspace. */
    AgentNotFound = "AGENT_PROFILE_AGENT_NOT_FOUND",
}

/** How each agent profile code travels. */
export const AGENT_PROFILE_ERROR_KINDS: Record<AgentProfileErrorCode, ErrorKind> = {
    [AgentProfileErrorCode.AgentNotFound]: "not-found",
}

/** The one error class of the agent profile capability. */
export class AgentProfileError extends DomainError<AgentProfileErrorCode> {}
