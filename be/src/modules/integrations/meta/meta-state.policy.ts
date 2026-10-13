import { deriveStateKey, sameSitePath, signStateToken, verifyStateToken } from "@modules/platform/primitives"
import { MetaError, MetaErrorCode } from "./errors/meta.error"
import { META_STATE_PURPOSE } from "./meta.contracts"
import type { MetaStateInput, OptionalMetaState, ReceivedText } from "./meta.contracts"

const STATE_TTL_MS = 10 * 60 * 1000
const DEFAULT_RETURN = "/connections"

/** A same-site Meta return path (one leading slash, no line break), else the connections page. */
export const metaReturnTo = (value: ReceivedText): string => sameSitePath(value, DEFAULT_RETURN)

/** The state-signing key for the Meta OAuth round trip: derived from the channel key, never the key itself, distinct from Google's. */
export const metaStateKey = (channelKeyBase64: string): Buffer => {
    const key = deriveStateKey(channelKeyBase64, "nivo:meta-oauth-state:v1")
    if (key === null) throw new MetaError({ code: MetaErrorCode.NotConfigured })
    return key
}

/** Signs a Meta state: base64url(JSON).base64url(HMAC-SHA256), valid for ten minutes. */
export const signMetaState = (key: Buffer, input: MetaStateInput, now: number): string =>
    signStateToken(key, {
        w: input.workspaceId,
        u: input.userId,
        r: metaReturnTo(input.returnTo),
        e: now + STATE_TTL_MS,
        p: META_STATE_PURPOSE,
    })

/** The state when the signature is valid, it has not expired and it carries the Meta purpose; otherwise null. */
export const verifyMetaState = (key: Buffer, value: ReceivedText, now: number): OptionalMetaState => {
    const state = verifyStateToken(key, value, now)
    return state === null || state.p !== META_STATE_PURPOSE ? null : { ...state, r: metaReturnTo(state.r) }
}
