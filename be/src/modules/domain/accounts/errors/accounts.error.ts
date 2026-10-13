import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the accounts capability. */
export enum AccountsErrorCode {
    /** The session to sign out is the one the request runs on; signing out uses the sign-out flow. */
    CurrentSession = "ACCOUNTS_CURRENT_SESSION",
    /** The caller has no such session. */
    SessionNotFound = "ACCOUNTS_SESSION_NOT_FOUND",
}

/** How each accounts code travels. */
export const ACCOUNTS_ERROR_KINDS: Record<AccountsErrorCode, ErrorKind> = {
    [AccountsErrorCode.CurrentSession]: "invalid",
    [AccountsErrorCode.SessionNotFound]: "not-found",
}

/** The one error class of the accounts capability. */
export class AccountsError extends DomainError<AccountsErrorCode> {}
