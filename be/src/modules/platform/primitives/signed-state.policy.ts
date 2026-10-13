import { createHmac, timingSafeEqual } from "node:crypto"
import { parseJsonText } from "./json-read.policy"
import { isRecord } from "./record.policy"
import type { OptionalSignedState, OptionalStateKey, OptionalStateText, SignedState } from "./signed-state.contracts"

const SAME_SITE_PATH = /^\/(?![/\\])/u
const LINE_BREAK = /[\r\n]/u
const KEY_BYTES = 32

const encode = (buffer: Buffer): string => buffer.toString("base64url")

const isSignedState = (value: unknown): value is SignedState =>
    isRecord(value) &&
    typeof value.w === "string" &&
    typeof value.u === "string" &&
    typeof value.r === "string" &&
    typeof value.e === "number" &&
    (value.p === undefined || typeof value.p === "string")

/** A same-site path (one leading slash, no line break), else the fallback path. */
export const sameSitePath = (value: OptionalStateText, fallback: string): string =>
    typeof value === "string" && SAME_SITE_PATH.test(value) && !LINE_BREAK.test(value) ? value : fallback

/** The key that signs one kind of state, derived from a 32-byte base64 channel key and a label; null when the key is not 32 bytes. */
export const deriveStateKey = (channelKeyBase64: string, label: string): OptionalStateKey => {
    const raw = Buffer.from(channelKeyBase64, "base64")
    return raw.length === KEY_BYTES ? createHmac("sha256", raw).update(label).digest() : null
}

/** Signs a state: base64url(JSON).base64url(HMAC-SHA256). */
export const signStateToken = (key: Buffer, state: SignedState): string => {
    const body = encode(Buffer.from(JSON.stringify(state)))
    return `${body}.${encode(createHmac("sha256", key).update(body).digest())}`
}

/** The state when the signature is valid, the body is a state and it has not expired at `now`; otherwise null. */
export const verifyStateToken = (key: Buffer, value: OptionalStateText, now: number): OptionalSignedState => {
    if (!value) return null
    const [body, signature, extra] = value.split(".")
    if (!body || !signature || extra !== undefined) return null
    const expected = createHmac("sha256", key).update(body).digest()
    const given = Buffer.from(signature, "base64url")
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    const read = parseJsonText(Buffer.from(body, "base64url").toString("utf8"))
    return read.ok && isSignedState(read.value) && read.value.e >= now ? read.value : null
}
