import { ZaloError } from "./errors/zalo.error"
import type { ZaloFailure } from "./zalo.contracts"

/** The numeric error Zalo gave with a refusal, or null when the failure carries none (a network failure). */
const zaloCodeOf = (error: unknown): number | null => {
    const code = error instanceof ZaloError ? error.params.zaloCode : undefined
    return typeof code === "number" ? code : null
}

/** Zalo's numeric errors (from its community docs; an unconfirmed one falls into `zalo_error`). */
export const zaloFailureOf = (error: unknown): ZaloFailure => {
    const code = zaloCodeOf(error)
    if (code === -230 || code === -232) return "zalo_window_expired"
    if (code === -213) return "zalo_unfollowed"
    if (code === -234) return "zalo_night_hours"
    if (code === -216 || code === -124 || code === -14014 || code === -14003) return "zalo_token"
    return "zalo_error"
}

/** True when Zalo said the access token itself is bad, so a refresh and one more try can succeed. */
export const isZaloTokenRejection = (error: unknown): boolean => {
    const code = zaloCodeOf(error)
    return code === -216 || code === -124
}

/** True when Zalo answered and said no, as opposed to not answering: only a new authorization fixes a refused refresh token. */
export const isZaloRefusal = (error: unknown): boolean => error instanceof ZaloError && error.params.path !== undefined
