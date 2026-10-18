import type { GraphQLResponse } from "@/modules/types"

/** Failure kinds an Auth call can end with (carried as the `message` of a failed outcome; the provider code is its `error`). */
export type AuthFailureKind = "refused" | "not-found" | "invalid" | "unavailable"

/** Wraps a value as a successful outcome. */
export const authOk = <T>(value: T): GraphQLResponse<T> => ({ success: true, message: "ok", data: value })

/** Builds an expected failure: the kind as the message, the provider code as the error. */
export const authFailure = <T = never>(kind: AuthFailureKind, code: string): GraphQLResponse<T> => ({
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

const REFUSED: ReadonlySet<string> = new Set(["401", "403", "invalid_credentials"])

/** Maps the error of a Supabase Auth call (null when it succeeded) into a failed outcome. */
export const failureOf = <T = never>(error: SupabaseAuthFailure | null): GraphQLResponse<T> | undefined => {
    if (error === null) return undefined
    const code = error.code ?? String(error.status ?? "transport")
    const signals = [error.code, error.status === undefined ? undefined : String(error.status)]
    return signals.some((signal) => signal !== undefined && REFUSED.has(signal))
        ? authFailure("refused", code)
        : authFailure("unavailable", code)
}
