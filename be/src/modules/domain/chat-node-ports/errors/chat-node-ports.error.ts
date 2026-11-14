import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the chat-node-ports capability. */
export enum ChatNodePortsErrorCode {
    /** The customer send payload is not a conversation or a customer with a text. */
    InvalidPayload = "CHAT_NODE_PORTS_INVALID_PAYLOAD",
    /** The channel is not taking messages for now (Zalo quota or night hours): nothing was sent, and the run engine tries the step again after a backoff. */
    DeliveryRateLimited = "CHAT_NODE_PORTS_DELIVERY_RATE_LIMITED",
}

/** How each chat-node-ports code travels. */
export const CHAT_NODE_PORTS_ERROR_KINDS: Record<ChatNodePortsErrorCode, ErrorKind> = {
    [ChatNodePortsErrorCode.InvalidPayload]: "invalid",
    [ChatNodePortsErrorCode.DeliveryRateLimited]: "unavailable",
}

/** The one error class of the chat-node-ports capability. */
export class ChatNodePortsError extends DomainError<ChatNodePortsErrorCode> {}
