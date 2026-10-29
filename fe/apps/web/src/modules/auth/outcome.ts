import type { GraphQLResponse } from "@/modules/types"

/** Failure kinds an Auth call can end with (carried as the `message` of a failed outcome; the back end code is its `error`). */
export type AuthFailureKind = "refused" | "not-found" | "invalid" | "unavailable"

/** Wraps a value as a successful outcome. */
export const authOk = <T>(value: T): GraphQLResponse<T> => ({ success: true, message: "ok", data: value })

/** Builds an expected failure: the kind as the message, the back end code as the error. */
export const authFailure = <T = never>(kind: AuthFailureKind, code: string): GraphQLResponse<T> => ({
    success: false,
    message: kind,
    error: code,
})

/** The failure kind an HTTP status of the back end auth doors stands for. */
const kindOfStatus = (status: number): AuthFailureKind => {
    if (status === 401 || status === 403) return "refused"
    if (status === 404) return "not-found"
    return status === 400 || status === 409 || status === 410 || status === 422 ? "invalid" : "unavailable"
}

/** Codes a status falls back to when the body names none, so the friendly copy can pick its sentence. */
export type StatusCodes = Readonly<Record<number, string>>

/** Maps a non-ok answer of an auth door (status plus the optional `code` of its JSON body) into a failed outcome. */
export const failureOfStatus = <T = never>(
    status: number,
    code: string | undefined,
    fallbacks: StatusCodes = {},
): GraphQLResponse<T> => authFailure(kindOfStatus(status), code ?? fallbacks[status] ?? String(status))
