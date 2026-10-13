import type { DbFailure, DbOutcome } from "@/modules/db"

/** What every browser Auth call answers with: the app one outcome vocabulary, never a throw for an expected failure. */
export type AuthOutcome<T> = DbOutcome<T>

/** Wraps a value as a successful outcome. */
export const authOk = <T>(value: T): AuthOutcome<T> => ({ kind: "ok", value })

/** Builds an expected failure. */
export const authFailure = (kind: DbFailure["kind"], code: string): DbFailure => ({ kind, code })

/** The structural part of a Supabase Auth error this module interprets. */
interface SupabaseAuthFailure {
    readonly code?: string
    readonly status?: number
    readonly message: string
}

const REFUSED = ["401", "403", "invalid_credentials"]

/** Maps the error of a Supabase Auth call (null when it succeeded) into the closed outcome vocabulary. */
export const failureOf = (error: SupabaseAuthFailure | null): DbFailure | undefined => {
    if (error === null) return undefined
    const code = error.code ?? String(error.status ?? "transport")
    const signals = [error.code, error.status === undefined ? undefined : String(error.status)]
    return signals.some((signal) => signal !== undefined && REFUSED.includes(signal))
        ? authFailure("refused", code)
        : authFailure("unavailable", code)
}
