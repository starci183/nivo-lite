import { createHmac, timingSafeEqual } from "node:crypto"
import { isRecord, parseJsonText } from "@modules/platform/primitives"

/** The marker of the plugin's credential; the tool door tells it from a per-job token by it. */
const PREFIX = "bridge."

/** How long a signed credential is honoured, in seconds: the plugin signs one call and means it for a minute. */
export const BRIDGE_TTL_SECONDS = 60

/** What the plugin signs: the agent and the session OpenClaw gave its tool, never anything the model wrote. */
export interface BridgeClaims {
    /** The runtime's id of the agent. */
    readonly agentId: string
    /** The runtime's session key. */
    readonly sessionKey: string
    /** Expiry, unix seconds. */
    readonly exp: number
}

/** The claims of a valid credential, or null. */
export type VerifiedBridgeClaims = BridgeClaims | null

const macOf = (secret: string, body: string): string =>
    createHmac("sha256", secret).update(`${PREFIX}${body}`).digest("base64url")

const same = (expected: string, given: string): boolean => {
    const a = Buffer.from(expected)
    const b = Buffer.from(given)
    return a.length === b.length && timingSafeEqual(a, b)
}

/** The credential the plugin builds (`nivo-bridge/bridge-token.js` signs the same bytes): the claims, then their signature. */
export const signBridgeToken = (secret: string, claims: BridgeClaims): string => {
    const body = Buffer.from(JSON.stringify({ a: claims.agentId, s: claims.sessionKey, e: claims.exp })).toString(
        "base64url",
    )
    return `${PREFIX}${body}.${macOf(secret, body)}`
}

const claimsOf = (body: string): VerifiedBridgeClaims => {
    const read = parseJsonText(Buffer.from(body, "base64url").toString("utf8"))
    if (!read.ok || !isRecord(read.value)) return null
    const { a, s, e } = read.value
    return typeof a === "string" && typeof s === "string" && typeof e === "number" && a !== "" && s !== ""
        ? { agentId: a, sessionKey: s, exp: e }
        : null
}

/**
 * The claims of a credential signed with the secret and not expired; null for a forged, expired or malformed one, and for one that claims
 * to outlive the plugin's own minute by more than a clock skew.
 */
export const verifyBridgeToken = (secret: string, token: string, nowSeconds: number): VerifiedBridgeClaims => {
    if (!token.startsWith(PREFIX)) return null
    const [body = "", mac = "", extra] = token.slice(PREFIX.length).split(".")
    if (body === "" || mac === "" || extra !== undefined || !same(macOf(secret, body), mac)) return null
    const claims = claimsOf(body)
    if (claims === null || claims.exp < nowSeconds || claims.exp > nowSeconds + 2 * BRIDGE_TTL_SECONDS) return null
    return claims
}

/** True when two session keys name the same session: the runtime may fold the case of a key it was given. */
export const sameSession = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
