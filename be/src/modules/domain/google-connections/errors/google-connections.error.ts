import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the google-connections capability. */
export enum GoogleConnectionsErrorCode {
    /** Google is not set up on this deployment. */
    NotConfigured = "GOOGLE_CONNECTIONS_NOT_CONFIGURED",
    /** The consent could not be started. */
    StartFailed = "GOOGLE_CONNECTIONS_START_FAILED",
    /** The workspace has no usable Google account for the operation. */
    Missing = "GOOGLE_CONNECTIONS_MISSING",
    /** The stored Google tokens were revoked or can no longer be read. */
    Lost = "GOOGLE_CONNECTIONS_LOST",
}

/** How each google-connections code travels. */
export const GOOGLE_CONNECTIONS_ERROR_KINDS: Record<GoogleConnectionsErrorCode, ErrorKind> = {
    [GoogleConnectionsErrorCode.NotConfigured]: "unavailable",
    [GoogleConnectionsErrorCode.StartFailed]: "unavailable",
    [GoogleConnectionsErrorCode.Missing]: "not-found",
    [GoogleConnectionsErrorCode.Lost]: "conflict",
}

/** The one error class of the google-connections capability. */
export class GoogleConnectionsError extends DomainError<GoogleConnectionsErrorCode> {}
