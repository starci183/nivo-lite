import { deriveStateKey, sameSitePath, signStateToken, verifyStateToken } from "@modules/platform/primitives"
import { STATE_TTL_MS } from "./google.contracts"
import type { ConsentResult, ConsentResultKey, OAuthState, OAuthStateInput, ReceivedText } from "./google.contracts"
import { GoogleError, GoogleErrorCode } from "./errors/google.error"

const DEFAULT_RETURN = "/connections"

/** A same-site path (one leading slash, no line break), else the default return path. */
export const safeReturnTo = (value: ReceivedText): string => sameSitePath(value, DEFAULT_RETURN)

/** Appends `?google=ok|error` (or `drive=`) and an optional reason to a return path, keeping its own query. */
export const withResult = (
    returnTo: string,
    result: ConsentResult,
    reason?: string,
    key: ConsentResultKey = "google",
): string => {
    const [path = DEFAULT_RETURN, query = ""] = safeReturnTo(returnTo).split("?")
    const params = new URLSearchParams(query)
    params.set(key, result)
    if (reason) params.set("reason", reason)
    else params.delete("reason")
    return `${path}?${params.toString()}`
}

/** Derives the state-signing key from the channel token key, never the channel key itself. */
export const stateKey = (channelKeyBase64: string): Buffer => {
    const key = deriveStateKey(channelKeyBase64, "nivo:google-oauth-state:v1")
    if (key === null) throw new GoogleError({ code: GoogleErrorCode.NotConfigured })
    return key
}

/** Signs a state: base64url(JSON).base64url(HMAC-SHA256), valid for ten minutes. */
export const signState = (key: Buffer, input: OAuthStateInput, now: number): string =>
    signStateToken(key, {
        w: input.workspaceId,
        u: input.userId,
        r: safeReturnTo(input.returnTo),
        e: now + STATE_TTL_MS,
        ...(input.purpose ? { p: input.purpose } : {}),
    })

/** The state when the signature is valid and it has not expired; otherwise null. */
export const verifyState = (key: Buffer, value: string | null | undefined, now: number): OAuthState | null => {
    const state = verifyStateToken(key, value, now)
    return state === null ? null : { ...state, r: safeReturnTo(state.r) }
}
