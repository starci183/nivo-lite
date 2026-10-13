import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the Supabase integration. */
export enum SupabaseErrorCode {
    /** The access token failed signature or required-claim verification. */
    AccessTokenInvalid = "SUPABASE_ACCESS_TOKEN_INVALID",
    /** A privileged Auth or Storage operation could not reach Supabase. */
    ProviderUnavailable = "SUPABASE_PROVIDER_UNAVAILABLE",
    /** Auth has no account with the requested id. */
    AccountNotFound = "SUPABASE_ACCOUNT_NOT_FOUND",
    /** Storage has no object at the requested path. */
    ObjectNotFound = "SUPABASE_OBJECT_NOT_FOUND",
}

/** How each Supabase integration code travels. */
export const SUPABASE_ERROR_KINDS: Record<SupabaseErrorCode, ErrorKind> = {
    [SupabaseErrorCode.AccessTokenInvalid]: "unauthenticated",
    [SupabaseErrorCode.ProviderUnavailable]: "unavailable",
    [SupabaseErrorCode.AccountNotFound]: "not-found",
    [SupabaseErrorCode.ObjectNotFound]: "not-found",
}

/** The one error class of the Supabase integration. */
export class SupabaseError extends DomainError<SupabaseErrorCode> {}
