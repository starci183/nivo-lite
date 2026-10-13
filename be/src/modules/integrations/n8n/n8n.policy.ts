import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import { isPrivateAddress } from "@modules/platform/primitives"
import { N8nError, N8nErrorCode } from "./errors/n8n.error"

/** Answers the addresses a host name resolves to. */
export type N8nHostResolver = (host: string) => Promise<ReadonlyArray<string>>

const EVENT_PATTERN = /^[a-z][a-z0-9_.-]*$/i
const EVENT_MAX = 80
const HTTP_ERROR_FLOOR = 500
const REQUEST_TIMEOUT = 408
const TOO_MANY_REQUESTS = 429

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
