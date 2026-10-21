import { CustomerTurnsError, CustomerTurnsErrorCode } from "./errors/customer-turns.error"
import type { CustomerTurnsOptions, PublicApiUrl } from "./customer-turns.options"

/** The path of the tool door under the public api origin (the agent-tools controller). */
const TOOLS_PATH = "/agent-tools"
/** The hosts a plain-http tool door may sit on: this machine only. */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"])

const isLoopback = (host: string): boolean => LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost")

const invalid = (url: string): CustomerTurnsError =>
    new CustomerTurnsError({ code: CustomerTurnsErrorCode.ToolsUrlInvalid, params: { url } })

/**
 * The base URL the agents call NIVO's tools at, from the public api origin: https, or http only on a loopback host, because the
 * per-turn tool token travels in its Authorization header. A missing, unreadable or insecure origin refuses the boot rather than
 * turning tools off quietly.
 */
export const toolsBaseUrlOf = (publicApiUrl: PublicApiUrl): string => {
    if (publicApiUrl === undefined || !URL.canParse(publicApiUrl)) throw invalid(publicApiUrl ?? "")
    const url = new URL(publicApiUrl)
    const secure = url.protocol === "https:" || (url.protocol === "http:" && isLoopback(url.hostname))
    if (!secure) throw invalid(url.origin)
    return `${url.origin}${TOOLS_PATH}`
}

/**
 * The options of the customer turns, derived from the already-parsed public api origin (PUBLIC_API_URL of the connections options):
 * no second read of the environment, and the module cannot register without a secure tool door.
 */
export const customerTurnsOptionsOf = (publicApiUrl: PublicApiUrl): CustomerTurnsOptions => ({
    toolsBaseUrl: toolsBaseUrlOf(publicApiUrl),
})
