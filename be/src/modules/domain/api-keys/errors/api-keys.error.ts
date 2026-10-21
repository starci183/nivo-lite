import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the api-keys capability. */
export enum ApiKeysErrorCode {
    /** The request carries no bearer key, or a key no workspace issued. */
    Unauthorized = "API_KEYS_UNAUTHORIZED",
    /** The key was revoked by a workspace manager. */
    Revoked = "API_KEYS_REVOKED",
    /** The key sent more requests than its budget allows in the current minute. */
    RateLimited = "API_KEYS_RATE_LIMITED",
    /** The key does not carry the scope the operation needs. */
    ScopeMissing = "API_KEYS_SCOPE_MISSING",
    /** The caller is not an owner or manager of the workspace. */
    NotManager = "API_KEYS_NOT_MANAGER",
    /** The workspace already has the most active keys it may hold. */
    LimitReached = "API_KEYS_LIMIT_REACHED",
    /** The key name is too short once trimmed. */
    NameTooShort = "API_KEYS_NAME_TOO_SHORT",
    /** No active key of the workspace has the requested id. */
    NotFound = "API_KEYS_NOT_FOUND",
    /** The insert answered no row: the key was not written. */
    NotCreated = "API_KEYS_NOT_CREATED",
    /** The agent an agent key was asked for is not an agent of the workspace. */
    AgentNotFound = "API_KEYS_AGENT_NOT_FOUND",
}

/** How each api-keys code travels. */
export const API_KEYS_ERROR_KINDS: Record<ApiKeysErrorCode, ErrorKind> = {
    [ApiKeysErrorCode.Unauthorized]: "unauthenticated",
    [ApiKeysErrorCode.Revoked]: "unauthenticated",
    [ApiKeysErrorCode.RateLimited]: "rate-limited",
    [ApiKeysErrorCode.ScopeMissing]: "forbidden",
    [ApiKeysErrorCode.NotManager]: "forbidden",
    [ApiKeysErrorCode.LimitReached]: "conflict",
    [ApiKeysErrorCode.NameTooShort]: "invalid",
    [ApiKeysErrorCode.NotFound]: "not-found",
    [ApiKeysErrorCode.NotCreated]: "internal",
    [ApiKeysErrorCode.AgentNotFound]: "not-found",
}

/** The one error class of the api-keys capability. */
export class ApiKeysError extends DomainError<ApiKeysErrorCode> {}
