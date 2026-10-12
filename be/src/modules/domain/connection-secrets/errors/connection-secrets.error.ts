import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the connection-secrets capability. */
export enum ConnectionSecretsErrorCode {
    /** CHANNEL_TOKEN_KEY is not 32 bytes of base64. */
    KeyInvalid = "CONNECTION_SECRETS_KEY_INVALID",
    /** The connection does not exist, is disconnected, is of another provider or belongs to another workspace. */
    NotFound = "CONNECTION_SECRETS_NOT_FOUND",
    /** The stored credential could not be opened with this key. */
    Unreadable = "CONNECTION_SECRETS_UNREADABLE",
}

/** How each connection-secrets code travels. */
export const CONNECTION_SECRETS_ERROR_KINDS: Record<ConnectionSecretsErrorCode, ErrorKind> = {
    [ConnectionSecretsErrorCode.KeyInvalid]: "internal",
    [ConnectionSecretsErrorCode.NotFound]: "not-found",
    [ConnectionSecretsErrorCode.Unreadable]: "internal",
}

/** The one error class of the connection-secrets capability. */
export class ConnectionSecretsError extends DomainError<ConnectionSecretsErrorCode> {}
