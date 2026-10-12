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
}

/** How each api-keys code travels. */
export const API_KEYS_ERROR_KINDS: Record<ApiKeysErrorCode, ErrorKind> = {
    [ApiKeysErrorCode.Unauthorized]: "unauthenticated",
    [ApiKeysErrorCode.Revoked]: "unauthenticated",
    [ApiKeysErrorCode.RateLimited]: "rate-limited",
    [ApiKeysErrorCode.ScopeMissing]: "forbidden",
}

/** The one error class of the api-keys capability. */
export class ApiKeysError extends DomainError<ApiKeysErrorCode> {}
