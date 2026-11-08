import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the sales-effects capability. */
export enum SalesEffectsErrorCode {
    /** The payload of the effect is not what the effect asks for. */
    InvalidPayload = "SALES_EFFECTS_INVALID_PAYLOAD",
    /** The conversation does not exist in the workspace of the turn. */
    ConversationNotFound = "SALES_EFFECTS_CONVERSATION_NOT_FOUND",
    /** The customer the order is for does not exist in the workspace of the turn. */
    LeadNotFound = "SALES_EFFECTS_LEAD_NOT_FOUND",
    /** The order to confirm does not exist in the workspace of the turn. */
    OrderNotFound = "SALES_EFFECTS_ORDER_NOT_FOUND",
    /** The engine did not make the write: the record moved under it, or a rule of its entity refused it. */
    WriteRefused = "SALES_EFFECTS_WRITE_REFUSED",
}

/** How each sales-effects code travels. */
export const SALES_EFFECTS_ERROR_KINDS: Record<SalesEffectsErrorCode, ErrorKind> = {
    [SalesEffectsErrorCode.InvalidPayload]: "invalid",
    [SalesEffectsErrorCode.ConversationNotFound]: "not-found",
    [SalesEffectsErrorCode.LeadNotFound]: "not-found",
    [SalesEffectsErrorCode.OrderNotFound]: "not-found",
    [SalesEffectsErrorCode.WriteRefused]: "conflict",
}

/** The one error class of the sales-effects capability. */
export class SalesEffectsError extends DomainError<SalesEffectsErrorCode> {}
