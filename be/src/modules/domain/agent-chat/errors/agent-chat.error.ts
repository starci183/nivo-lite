import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Stable refusals of the agent chat capability. */
export enum AgentChatErrorCode {
    /** The selected agent is absent from the workspace. */
    AgentNotFound = "AGENT_CHAT_AGENT_NOT_FOUND",
    /** The selected conversation is absent from the workspace. */
    ConversationNotFound = "AGENT_CHAT_CONVERSATION_NOT_FOUND",
    /** The message has no queued chat turn in this workspace. */
    TurnNotFound = "AGENT_CHAT_TURN_NOT_FOUND",
    /** The bounded message becomes empty after trimming. */
    InvalidBody = "AGENT_CHAT_INVALID_BODY",
}

/** How each refusal travels through the API. */
export const AGENT_CHAT_ERROR_KINDS: Record<AgentChatErrorCode, ErrorKind> = {
    [AgentChatErrorCode.AgentNotFound]: "not-found",
    [AgentChatErrorCode.ConversationNotFound]: "not-found",
    [AgentChatErrorCode.TurnNotFound]: "not-found",
    [AgentChatErrorCode.InvalidBody]: "invalid",
}

/** The error class of the agent chat capability. */
export class AgentChatError extends DomainError<AgentChatErrorCode> {}
