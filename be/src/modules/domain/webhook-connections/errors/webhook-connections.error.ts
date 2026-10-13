import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the webhook-connections capability. */
export enum WebhookConnectionsErrorCode {
    /** No event was picked. */
    EventsEmpty = "WEBHOOK_CONNECTIONS_EVENTS_EMPTY",
    /** The connection name is shorter than two characters. */
    NameInvalid = "WEBHOOK_CONNECTIONS_NAME_INVALID",
    /** The address cannot be a delivery target. */
    UrlRefused = "WEBHOOK_CONNECTIONS_URL_REFUSED",
    /** The deployment has no signing key for outgoing webhooks. */
    SigningUnavailable = "WEBHOOK_CONNECTIONS_SIGNING_UNAVAILABLE",
    /** The connection holds no webhook address. */
    NoUrl = "WEBHOOK_CONNECTIONS_NO_URL",
}

/** How each webhook-connections code travels. */
export const WEBHOOK_CONNECTIONS_ERROR_KINDS: Record<WebhookConnectionsErrorCode, ErrorKind> = {
    [WebhookConnectionsErrorCode.EventsEmpty]: "invalid",
    [WebhookConnectionsErrorCode.NameInvalid]: "invalid",
    [WebhookConnectionsErrorCode.UrlRefused]: "invalid",
    [WebhookConnectionsErrorCode.SigningUnavailable]: "unavailable",
    [WebhookConnectionsErrorCode.NoUrl]: "not-found",
}

/** The one error class of the webhook-connections capability. */
export class WebhookConnectionsError extends DomainError<WebhookConnectionsErrorCode> {}
