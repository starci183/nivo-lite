import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the identity capability. */
export enum IdentityErrorCode {
    /** The door needs a signed-in caller and the request establishes none. */
    Unauthenticated = "IDENTITY_UNAUTHENTICATED",
    /** The access token failed signature, issuer, audience or expiry verification. */
    AccessTokenInvalid = "IDENTITY_ACCESS_TOKEN_INVALID",
    /** The email and password pair is wrong (the same answer for an unknown email). */
    InvalidCredentials = "IDENTITY_INVALID_CREDENTIALS",
    /** The account is deleted or banned. */
    AccountDisabled = "IDENTITY_ACCOUNT_DISABLED",
    /** The refresh token is unknown, expired or already rotated. */
    RefreshInvalid = "IDENTITY_REFRESH_INVALID",
    /** A rotated refresh token was presented again: the session was ended. */
    RefreshReused = "IDENTITY_REFRESH_REUSED",
    /** The password link is unknown, used or expired. */
    ResetTokenInvalid = "IDENTITY_RESET_TOKEN_INVALID",
    /** The new password breaks the password policy. */
    PasswordInvalid = "IDENTITY_PASSWORD_INVALID",
    /** Too many attempts for this address; try again later. */
    TooManyAttempts = "IDENTITY_TOO_MANY_ATTEMPTS",
    /** Google did not vouch for the mailbox, so no account can be found or linked by it. */
    GoogleEmailUnverified = "IDENTITY_GOOGLE_EMAIL_UNVERIFIED",
    /** The mailbox was never confirmed through the signup link. */
    EmailNotConfirmed = "IDENTITY_EMAIL_NOT_CONFIRMED",
    /** No account has that id. */
    AccountNotFound = "IDENTITY_ACCOUNT_NOT_FOUND",
}

/** How each identity code travels. */
export const IDENTITY_ERROR_KINDS: Record<IdentityErrorCode, ErrorKind> = {
    [IdentityErrorCode.Unauthenticated]: "unauthenticated",
    [IdentityErrorCode.AccessTokenInvalid]: "unauthenticated",
    [IdentityErrorCode.InvalidCredentials]: "unauthenticated",
    [IdentityErrorCode.AccountDisabled]: "forbidden",
    [IdentityErrorCode.RefreshInvalid]: "unauthenticated",
    [IdentityErrorCode.RefreshReused]: "unauthenticated",
    [IdentityErrorCode.ResetTokenInvalid]: "invalid",
    [IdentityErrorCode.PasswordInvalid]: "invalid",
    [IdentityErrorCode.TooManyAttempts]: "rate-limited",
    [IdentityErrorCode.GoogleEmailUnverified]: "forbidden",
    [IdentityErrorCode.EmailNotConfirmed]: "forbidden",
    [IdentityErrorCode.AccountNotFound]: "not-found",
}

/** The one error class of the identity capability. */
export class IdentityError extends DomainError<IdentityErrorCode> {}
