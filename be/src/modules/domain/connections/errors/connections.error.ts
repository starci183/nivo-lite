import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the connections capability. */
export enum ConnectionsErrorCode {
    /** The caller is not an active member of the workspace with one of the required roles. */
    Forbidden = "CONNECTIONS_FORBIDDEN",
    /** The workspace has no such connection. */
    NotFound = "CONNECTIONS_NOT_FOUND",
    /** The connection name is shorter than two characters once trimmed. */
    NameInvalid = "CONNECTIONS_NAME_INVALID",
    /** A connection must be disconnected before it is removed. */
    StillConnected = "CONNECTIONS_STILL_CONNECTED",
    /** CHANNEL_TOKEN_KEY is not 32 bytes in base64. */
    KeyInvalid = "CONNECTIONS_KEY_INVALID",
    /** The connector id is not a planned connector of the catalog. */
    ConnectorNotFound = "CONNECTIONS_CONNECTOR_NOT_FOUND",
    /** A console command named an unknown kind or carried an input that does not fit it. */
    CommandInvalid = "CONNECTIONS_COMMAND_INVALID",
}

/** How each connections code travels. */
export const CONNECTIONS_ERROR_KINDS: Record<ConnectionsErrorCode, ErrorKind> = {
    [ConnectionsErrorCode.Forbidden]: "forbidden",
    [ConnectionsErrorCode.NotFound]: "not-found",
    [ConnectionsErrorCode.NameInvalid]: "invalid",
    [ConnectionsErrorCode.StillConnected]: "conflict",
    [ConnectionsErrorCode.KeyInvalid]: "internal",
    [ConnectionsErrorCode.ConnectorNotFound]: "not-found",
    [ConnectionsErrorCode.CommandInvalid]: "invalid",
}

/** The one error class of the connections capability. */
export class ConnectionsError extends DomainError<ConnectionsErrorCode> {}
