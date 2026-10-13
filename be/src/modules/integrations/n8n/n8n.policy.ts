import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import { N8nError, N8nErrorCode } from "./errors/n8n.error"

/** Answers the addresses a host name resolves to. */
export type N8nHostResolver = (host: string) => Promise<ReadonlyArray<string>>

const EVENT_PATTERN = /^[a-z][a-z0-9_.-]*$/i
const EVENT_MAX = 80
const IPV4_PARTS = 4
const MAPPED_IPV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/
const UNIQUE_LOCAL_OR_LINK_LOCAL = /^(fc|fd|fe[89ab])/
const HTTP_ERROR_FLOOR = 500
const REQUEST_TIMEOUT = 408
const TOO_MANY_REQUESTS = 429

/** True for loopback, private, link-local, unique-local, shared and unspecified addresses (IPv4 and IPv6); anything unparsable counts as private. */
export const isPrivateAddress = (address: string): boolean => {
    const text = address.toLowerCase().replace(/^\[|\]$/g, "")
    if (isIP(text) === 6) {
        const mapped = MAPPED_IPV4.exec(text)
        if (mapped?.[1] !== undefined) return isPrivateAddress(mapped[1])
        return text === "::1" || text === "::" || UNIQUE_LOCAL_OR_LINK_LOCAL.test(text)
    }
    const parts = text.split(".").map(Number)
    if (parts.length !== IPV4_PARTS || parts.some((part) => !Number.isInteger(part))) return true
    const [first = 0, second = 0] = parts
    return (
        first === 0 ||
        first === 10 ||
        first === 127 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 100 && second >= 64 && second <= 127)
    )
}

/**
 * Webhook urls are tenant-supplied, so the server must not be a way into its own network. A target is http(s), carries no
 * credentials and resolves only to public addresses, unless its host is on the explicit allow list.
 */
export const assertAllowedTarget = async (
    raw: string,
    allowedHosts: ReadonlyArray<string>,
    resolve: N8nHostResolver,
): Promise<URL> => {
    if (!URL.canParse(raw)) throw new N8nError({ code: N8nErrorCode.TargetRefused, params: { reason: "not-a-url" } })
    const url = new URL(raw)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new N8nError({ code: N8nErrorCode.TargetRefused, params: { reason: "protocol" } })
    }
    if (url.username !== "" || url.password !== "") {
        throw new N8nError({ code: N8nErrorCode.TargetRefused, params: { reason: "credentials" } })
    }
    if (allowedHosts.includes(url.hostname)) return url
    const host = url.hostname.replace(/^\[|\]$/g, "")
    const addresses = isIP(host) === 0 ? await resolve(host) : [host]
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
        throw new N8nError({ code: N8nErrorCode.TargetRefused, params: { reason: "private-address" } })
    }
    return url
}

/** The event name of a delivery: a dotted identifier of at most 80 characters. */
export const assertEventName = (event: string): string => {
    if (!EVENT_PATTERN.test(event) || event.length > EVENT_MAX) {
        throw new N8nError({ code: N8nErrorCode.EventInvalid })
    }
    return event
}

/** The key one workspace signs its deliveries with: derived from the secret, so a leaked key reveals neither the secret nor another workspace. */
export const workspaceKey = (secret: string, workspaceId: string): string =>
    createHmac("sha256", secret).update(`n8n:${workspaceId}`).digest("hex")

/** The hex HMAC-SHA256 of `<timestamp>.<raw body>` the receiver recomputes. */
export const signBody = (key: string, timestamp: string, rawBody: string): string =>
    createHmac("sha256", key).update(`${timestamp}.${rawBody}`).digest("hex")

/** True when an answer status is worth another delivery attempt. */
export const isTransientStatus = (status: number): boolean =>
    status >= HTTP_ERROR_FLOOR || status === REQUEST_TIMEOUT || status === TOO_MANY_REQUESTS
