import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the chat-node-ports capability. */
export enum ChatNodePortsErrorCode {
    /** The channel.send payload is not a conversation id and a text. */
    InvalidPayload = "CHAT_NODE_PORTS_INVALID_PAYLOAD",
    /** The conversation does not exist in the workspace of the turn. */
    ConversationNotFound = "CHAT_NODE_PORTS_CONVERSATION_NOT_FOUND",
    /** A node tried to speak in a conversation other than the one its turn serves. */
    WrongConversation = "CHAT_NODE_PORTS_WRONG_CONVERSATION",
    /** A person took the conversation over: the agent stays silent. */
    HeldByPerson = "CHAT_NODE_PORTS_HELD_BY_PERSON",
    /** Another agent speaks in the conversation now. */
    NotSpeaking = "CHAT_NODE_PORTS_NOT_SPEAKING",
    /** The customer last wrote on Zalo more than 48 hours ago, so a reply cannot go out. */
    ZaloWindowExpired = "CHAT_NODE_PORTS_ZALO_WINDOW_EXPIRED",
    /** The channel refused the message. */
    DeliveryRejected = "CHAT_NODE_PORTS_DELIVERY_REJECTED",
    /** The channel is not taking messages for now (Zalo quota or night hours): nothing was sent, and the run engine tries the step again after a backoff. */
    DeliveryRateLimited = "CHAT_NODE_PORTS_DELIVERY_RATE_LIMITED",
    /** The channel did not say whether it took the message. */
    DeliveryUnconfirmed = "CHAT_NODE_PORTS_DELIVERY_UNCONFIRMED",
    /** The customer cannot be reached on the channel (no recipient yet, an imported placeholder, a user who does not follow the account): the message stays in the conversation marked failed. */
    RecipientUnreachable = "CHAT_NODE_PORTS_RECIPIENT_UNREACHABLE",
    /** The plan of the channel does not let the agent answer: the message stays in the conversation marked failed. */
    ChannelPlanBlocked = "CHAT_NODE_PORTS_CHANNEL_PLAN_BLOCKED",
    /** The engine refused to store the proposed reply (the conversation or the line moved, or a proposal was stored at the same moment). */
    ProposalRefused = "CHAT_NODE_PORTS_PROPOSAL_REFUSED",
}

/** How each chat-node-ports code travels. */
export const CHAT_NODE_PORTS_ERROR_KINDS: Record<ChatNodePortsErrorCode, ErrorKind> = {
    [ChatNodePortsErrorCode.InvalidPayload]: "invalid",
    [ChatNodePortsErrorCode.ConversationNotFound]: "not-found",
    [ChatNodePortsErrorCode.WrongConversation]: "forbidden",
    [ChatNodePortsErrorCode.HeldByPerson]: "conflict",
    [ChatNodePortsErrorCode.NotSpeaking]: "forbidden",
    [ChatNodePortsErrorCode.ZaloWindowExpired]: "conflict",
    [ChatNodePortsErrorCode.DeliveryRejected]: "unavailable",
    [ChatNodePortsErrorCode.DeliveryRateLimited]: "unavailable",
    [ChatNodePortsErrorCode.DeliveryUnconfirmed]: "unavailable",
    [ChatNodePortsErrorCode.RecipientUnreachable]: "conflict",
    [ChatNodePortsErrorCode.ChannelPlanBlocked]: "conflict",
    [ChatNodePortsErrorCode.ProposalRefused]: "conflict",
}

/** The one error class of the chat-node-ports capability. */
export class ChatNodePortsError extends DomainError<ChatNodePortsErrorCode> {}
