import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the n8n integration. */
export enum N8nErrorCode {
    /** The event has no webhook url to go to. */
    NoTarget = "N8N_NO_TARGET",
    /** The event name is not a dotted identifier. */
    EventInvalid = "N8N_EVENT_INVALID",
    /** Every target refused the event for good (a private address, a bad url, an answer that retrying cannot change). */
    TargetRefused = "N8N_TARGET_REFUSED",
    /** A target could not be reached or answered with a transient failure; the delivery is worth another try. */
    DeliveryFailed = "N8N_DELIVERY_FAILED",
}

/** How each n8n code travels. */
export const N8N_ERROR_KINDS: Record<N8nErrorCode, ErrorKind> = {
    [N8nErrorCode.NoTarget]: "invalid",
    [N8nErrorCode.EventInvalid]: "invalid",
    [N8nErrorCode.TargetRefused]: "invalid",
    [N8nErrorCode.DeliveryFailed]: "unavailable",
}

/** The one error class of the n8n integration. */
export class N8nError extends DomainError<N8nErrorCode> {}
