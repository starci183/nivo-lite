import dns from "node:dns/promises"
import { isIP } from "node:net"
import { isPrivateAddress } from "@modules/platform/primitives"

/** The schemes a remote MCP server may be reached over. */
const SCHEMES: ReadonlySet<string> = new Set(["http:", "https:"])

/**
 * Whether a remote server address may be connected to: an http(s) URL whose host is, or resolves only to, public addresses. Loopback,
 * private, link-local, shared and metadata addresses (any of a host's answers) and a host that does not resolve are refused. The
 * check runs when a connector is registered and again before every connection, so a name that later points inside is refused too.
 */
export const isPublicEndpoint = async (url: string): Promise<boolean> => {
    if (!URL.canParse(url)) return false
    const parsed = new URL(url)
    if (!SCHEMES.has(parsed.protocol)) return false
    const host = parsed.hostname.replace(/^\[|\]$/gu, "")
    if (isIP(host) !== 0) return !isPrivateAddress(host)
    const answers = await dns.lookup(host, { all: true }).catch(() => [])
    return answers.length > 0 && !answers.some((answer) => isPrivateAddress(answer.address))
}
