import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-conversations capability. */
export enum AgentConversationsErrorCode {
    /** The conversation does not exist. */
    NotFound = "AGENT_CONVERSATIONS_NOT_FOUND",
    /** The insert answered no row: the conversation was not written. */
    NotStored = "AGENT_CONVERSATIONS_NOT_STORED",
}

/** How each agent-conversations code travels. */
export const AGENT_CONVERSATIONS_ERROR_KINDS: Record<AgentConversationsErrorCode, ErrorKind> = {
    [AgentConversationsErrorCode.NotFound]: "not-found",
    [AgentConversationsErrorCode.NotStored]: "internal",
}

/** The one error class of the agent-conversations capability. */
export class AgentConversationsError extends DomainError<AgentConversationsErrorCode> {}
