import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the agent-messages capability. */
export enum AgentMessagesErrorCode {
    /** The message does not exist in that conversation. */
    NotFound = "AGENT_MESSAGES_NOT_FOUND",
    /** The insert answered no row: the message was not written. */
    NotStored = "AGENT_MESSAGES_NOT_STORED",
}

/** How each agent-messages code travels. */
export const AGENT_MESSAGES_ERROR_KINDS: Record<AgentMessagesErrorCode, ErrorKind> = {
    [AgentMessagesErrorCode.NotFound]: "not-found",
    [AgentMessagesErrorCode.NotStored]: "internal",
}

/** The one error class of the agent-messages capability. */
export class AgentMessagesError extends DomainError<AgentMessagesErrorCode> {}
