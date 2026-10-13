import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the connections capability. */
export enum ConnectionsErrorCode {
    /** The connection does not exist, is disconnected or is of another provider. */
    NotFound = "CONNECTIONS_NOT_FOUND",
}

/** How each connections code travels. */
export const CONNECTIONS_ERROR_KINDS: Record<ConnectionsErrorCode, ErrorKind> = {
    [ConnectionsErrorCode.NotFound]: "not-found",
}

/** The one error class of the connections capability. */
export class ConnectionsError extends DomainError<ConnectionsErrorCode> {}
