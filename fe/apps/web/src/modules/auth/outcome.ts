/** Failure kinds an Auth call can end with (carried as the `message` of a failed outcome; the provider code is its `error`). */
export type AuthFailureKind = "refused" | "not-found" | "invalid" | "unavailable"

/**
 * What every Auth call answers with, in the field shape of the app result vocabulary (`GraphQLResponse<T>` of modules/api, which
 * this module cannot import: modules/api depends on modules/auth for the access token). Never a throw for an expected failure.
 */
export interface AuthOutcome<T> {
    readonly success: boolean
    readonly message: string
    readonly error?: string
    readonly data?: T
}

/** Wraps a value as a successful outcome. */
export const authOk = <T>(value: T): AuthOutcome<T> => ({ success: true, message: "ok", data: value })

/** Builds an expected failure: the kind as the message, the provider code as the error. */
export const authFailure = <T = never>(kind: AuthFailureKind, code: string): AuthOutcome<T> => ({
    success: false,
    message: kind,
    error: code,
})

/** The structural part of a Supabase Auth error this module interprets. */
interface SupabaseAuthFailure {
    readonly code?: string
    readonly status?: number
    readonly message: string
}

const REFUSED = ["401", "403", "invalid_credentials"]

/** Maps the error of a Supabase Auth call (null when it succeeded) into a failed outcome. */
export const failureOf = <T = never>(error: SupabaseAuthFailure | null): AuthOutcome<T> | undefined => {
    if (error === null) return undefined
    const code = error.code ?? String(error.status ?? "transport")
    const signals = [error.code, error.status === undefined ? undefined : String(error.status)]
    return signals.some((signal) => signal !== undefined && REFUSED.includes(signal))
        ? authFailure("refused", code)
        : authFailure("unavailable", code)
}
