import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

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
    /** The channel did not say whether it took the message. */
    DeliveryUnconfirmed = "CHAT_NODE_PORTS_DELIVERY_UNCONFIRMED",
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
    [ChatNodePortsErrorCode.DeliveryUnconfirmed]: "unavailable",
}

/** The one error class of the chat-node-ports capability. */
export class ChatNodePortsError extends DomainError<ChatNodePortsErrorCode> {}
