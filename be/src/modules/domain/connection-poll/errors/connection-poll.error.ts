import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the connection-poll capability. */
export enum ConnectionPollErrorCode {
    /** The provider's rate limit leaves no call for this connection yet: the poll ends and is planned again at the time named in the params as `waitMs`. */
    Deferred = "CONNECTION_POLL_DEFERRED",
}

/** How each connection-poll code travels. */
export const CONNECTION_POLL_ERROR_KINDS: Record<ConnectionPollErrorCode, ErrorKind> = {
    [ConnectionPollErrorCode.Deferred]: "rate-limited",
}

/** The one error class of the connection-poll capability. */
export class ConnectionPollError extends DomainError<ConnectionPollErrorCode> {}
