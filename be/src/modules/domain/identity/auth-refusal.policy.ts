import { AuthError, PassportError, PassportErrorCode } from "@modules/integrations/passport"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"

/** The codes of @starci/auth that are identity errors of this app. */
const IDENTITY_REFUSALS: ReadonlyArray<IdentityErrorCode> = [
    IdentityErrorCode.Unauthenticated,
    IdentityErrorCode.PairRefused,
    IdentityErrorCode.AccountDisabled,
    IdentityErrorCode.RefreshInvalid,
    IdentityErrorCode.RefreshReused,
    IdentityErrorCode.TooManyAttempts,
    IdentityErrorCode.EmailNotConfirmed,
    IdentityErrorCode.PasswordInvalid,
    IdentityErrorCode.ResetTokenInvalid,
]

/** The codes of @starci/auth that are passport errors of this app. */
const PASSPORT_REFUSALS: ReadonlyArray<PassportErrorCode> = [
    PassportErrorCode.AccessTokenInvalid,
    PassportErrorCode.KeyInvalid,
    PassportErrorCode.MissingCredentials,
    PassportErrorCode.GoogleStateInvalid,
    PassportErrorCode.GoogleRejected,
    PassportErrorCode.GoogleUnavailable,
]

/**
 * The error of this app a refusal of @starci/auth stands for: the identity error for a wire code `IDENTITY_*`, the passport error for a
 * code `PASSPORT_*`, so the errors filter keeps answering the same code on the wire; undefined for a code of neither family.
 */
export const refusalOf = (refusal: AuthError): IdentityError | PassportError | undefined => {
    const identity = IDENTITY_REFUSALS.find((code) => code === refusal.code)
    if (identity !== undefined) return new IdentityError({ code: identity, cause: refusal })
    const passport = PASSPORT_REFUSALS.find((code) => code === refusal.code)
    return passport === undefined ? undefined : new PassportError({ code: passport, cause: refusal })
}

/** Runs work of the package and throws its refusals as this app's errors; any other failure, and a code this app does not know, passes through unchanged. */
export const refusing = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
        return await work()
    } catch (cause) {
        const refusal = cause instanceof AuthError ? refusalOf(cause) : undefined
        if (refusal !== undefined) throw refusal
        throw cause
    }
}
