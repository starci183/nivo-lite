import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent profile capability. */
export enum AgentProfileErrorCode {
    /** The member may not hand this agent work: not by role, not by a room, or the agent is paused. */
    AssignForbidden = "AGENT_PROFILE_ASSIGN_FORBIDDEN",
    /** The request is empty or longer than allowed. */
    RequestInvalid = "AGENT_PROFILE_REQUEST_INVALID",
    /** The app has no work threads capability, so an assignment cannot be recorded. */
    ThreadsUnbound = "AGENT_PROFILE_THREADS_UNBOUND",
    /** The agent is not in this workspace. */
    AgentNotFound = "AGENT_PROFILE_AGENT_NOT_FOUND",
}

/** How each agent profile code travels. */
export const AGENT_PROFILE_ERROR_KINDS: Record<AgentProfileErrorCode, ErrorKind> = {
    [AgentProfileErrorCode.AssignForbidden]: "forbidden",
    [AgentProfileErrorCode.RequestInvalid]: "invalid",
    [AgentProfileErrorCode.ThreadsUnbound]: "unavailable",
    [AgentProfileErrorCode.AgentNotFound]: "not-found",
}

/** The one error class of the agent profile capability. */
export class AgentProfileError extends DomainError<AgentProfileErrorCode> {}
