import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the connection-grants capability. */
export enum ConnectionGrantsErrorCode {
    /** The agent module cannot use that kind of connection. */
    PairRefused = "CONNECTION_GRANTS_PAIR_REFUSED",
    /** A disconnected connection cannot be given to an agent. */
    ConnectionDisconnected = "CONNECTION_GRANTS_CONNECTION_DISCONNECTED",
}

/** How each connection-grants code travels. */
export const CONNECTION_GRANTS_ERROR_KINDS: Record<ConnectionGrantsErrorCode, ErrorKind> = {
    [ConnectionGrantsErrorCode.PairRefused]: "invalid",
    [ConnectionGrantsErrorCode.ConnectionDisconnected]: "conflict",
}

/** The one error class of the connection-grants capability. */
export class ConnectionGrantsError extends DomainError<ConnectionGrantsErrorCode> {}
