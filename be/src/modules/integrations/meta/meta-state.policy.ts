import { createHmac, timingSafeEqual } from "node:crypto"
import { MetaError, MetaErrorCode } from "./errors/meta.error"
import { META_STATE_PURPOSE } from "./meta.contracts"
import type { MetaState, MetaStateInput } from "./meta.contracts"

const STATE_TTL_MS = 10 * 60 * 1000
const DEFAULT_RETURN = "/connections"
const SAME_SITE_PATH = /^\/(?![/\\])/u
const LINE_BREAK = /[\r\n]/u
const KEY_BYTES = 32

/** A same-site path (one leading slash, no line break), else the default return path. */
export const safeReturnTo = (value: string | null | undefined): string =>
    typeof value === "string" && SAME_SITE_PATH.test(value) && !LINE_BREAK.test(value) ? value : DEFAULT_RETURN

/** The state-signing key for the Meta OAuth round trip: derived from the channel key, never the key itself, distinct from Google's. */
export const metaStateKey = (channelKeyBase64: string): Buffer => {
    const raw = Buffer.from(channelKeyBase64, "base64")
    if (raw.length !== KEY_BYTES) throw new MetaError({ code: MetaErrorCode.NotConfigured })
    return createHmac("sha256", raw).update("nivo:meta-oauth-state:v1").digest()
}

const encode = (buffer: Buffer): string => buffer.toString("base64url")

/** Signs a Meta state: base64url(JSON).base64url(HMAC-SHA256), valid for ten minutes. */
export const signMetaState = (key: Buffer, input: MetaStateInput, now: number): string => {
    const state: MetaState = {
        w: input.workspaceId,
        u: input.userId,
        r: safeReturnTo(input.returnTo),
        e: now + STATE_TTL_MS,
        p: META_STATE_PURPOSE,
    }
    const body = encode(Buffer.from(JSON.stringify(state)))
    return `${body}.${encode(createHmac("sha256", key).update(body).digest())}`
}

const isState = (value: unknown): value is MetaState => {
    if (typeof value !== "object" || value === null) return false
    const state = value as Partial<Record<keyof MetaState, unknown>>
    return (
        typeof state.w === "string" &&
        typeof state.u === "string" &&
        typeof state.r === "string" &&
        typeof state.e === "number" &&
        (state.p === undefined || typeof state.p === "string")
    )
}

/** The state when the signature is valid, it has not expired and it carries the Meta purpose; otherwise null. */
export const verifyMetaState = (key: Buffer, value: string | null | undefined, now: number): MetaState | null => {
    if (!value) return null
    const [body, signature, extra] = value.split(".")
    if (!body || !signature || extra !== undefined) return null
    const expected = createHmac("sha256", key).update(body).digest()
    const given = Buffer.from(signature, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    try {
        const state: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
        if (!isState(state) || state.e < now || state.p !== META_STATE_PURPOSE) return null
        return { ...state, r: safeReturnTo(state.r) }
    } catch {
        return null
    }
}
