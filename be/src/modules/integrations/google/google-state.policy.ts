import { createHmac, timingSafeEqual } from "node:crypto"
import { STATE_TTL_MS } from "./google.contracts"
import type { OAuthState, OAuthStateInput } from "./google.contracts"
import { GoogleError, GoogleErrorCode } from "./errors/google.error"

const DEFAULT_RETURN = "/connections"
const SAME_SITE_PATH = /^\/(?![/\\])/u
const LINE_BREAK = /[\r\n]/u
const KEY_BYTES = 32

/** A same-site path (one leading slash, no line break), else the default return path. */
export const safeReturnTo = (value: string | null | undefined): string =>
    typeof value === "string" && SAME_SITE_PATH.test(value) && !LINE_BREAK.test(value) ? value : DEFAULT_RETURN

/** Appends `?google=ok|error` (or `drive=`) and an optional reason to a return path, keeping its own query. */
export const withResult = (
    returnTo: string,
    result: "ok" | "error",
    reason?: string,
    key: "google" | "drive" = "google",
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
    const raw = Buffer.from(channelKeyBase64, "base64")
    if (raw.length !== KEY_BYTES) throw new GoogleError({ code: GoogleErrorCode.NotConfigured })
    return createHmac("sha256", raw).update("nivo:google-oauth-state:v1").digest()
}

const encode = (buffer: Buffer): string => buffer.toString("base64url")

/** Signs a state: base64url(JSON).base64url(HMAC-SHA256), valid for ten minutes. */
export const signState = (key: Buffer, input: OAuthStateInput, now: number): string => {
    const state: OAuthState = {
        w: input.workspaceId,
        u: input.userId,
        r: safeReturnTo(input.returnTo),
        e: now + STATE_TTL_MS,
        ...(input.purpose ? { p: input.purpose } : {}),
    }
    const body = encode(Buffer.from(JSON.stringify(state)))
    return `${body}.${encode(createHmac("sha256", key).update(body).digest())}`
}

const isState = (value: unknown): value is OAuthState => {
    if (typeof value !== "object" || value === null) return false
    const state = value as Partial<Record<keyof OAuthState, unknown>>
    return (
        typeof state.w === "string" &&
        typeof state.u === "string" &&
        typeof state.r === "string" &&
        typeof state.e === "number" &&
        (state.p === undefined || typeof state.p === "string")
    )
}

/** The state when the signature is valid and it has not expired; otherwise null. */
export const verifyState = (key: Buffer, value: string | null | undefined, now: number): OAuthState | null => {
    if (!value) return null
    const [body, signature, extra] = value.split(".")
    if (!body || !signature || extra !== undefined) return null
    const expected = createHmac("sha256", key).update(body).digest()
    const given = Buffer.from(signature, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    try {
        const state: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
        if (!isState(state) || state.e < now) return null
        return { ...state, r: safeReturnTo(state.r) }
    } catch {
        return null
    }
}
