import dns from "node:dns/promises"
import { isIP } from "node:net"
import { isPrivateAddress } from "@modules/platform/primitives"

/** The schemes a remote MCP server may be reached over. */
const SCHEMES: ReadonlySet<string> = new Set(["http:", "https:"])

/** The public address a connection to a remote server is pinned to. */
export interface PublicAddress {
    /** The IP address to connect to. */
    readonly address: string
    /** Its family. */
    readonly family: 4 | 6
}

/**
 * The public address a remote server address resolves to, or null when it may not be connected to: not an http(s) URL, a host that is
 * (or resolves to, in any of its answers) a loopback, private, link-local, shared or metadata address, or a host that does not
 * resolve. The caller connects to the address answered and resolves nothing again, so the name cannot point inside afterwards.
 */
export const publicAddressOf = async (url: string): Promise<PublicAddress | null> => {
    if (!URL.canParse(url)) return null
    const parsed = new URL(url)
    if (!SCHEMES.has(parsed.protocol)) return null
    const host = parsed.hostname.replace(/^\[|\]$/gu, "")
    const family = isIP(host)
    if (family === 4 || family === 6) return isPrivateAddress(host) ? null : { address: host, family }
    const looked = await dns.lookup(host, { all: true }).then(
        (answers) => ({ answers }),
        (cause: unknown) => ({ answers: [], cause }),
    )
    const [first] = looked.answers
    if (first === undefined || looked.answers.some((answer) => isPrivateAddress(answer.address))) return null
    return { address: first.address, family: first.family === 6 ? 6 : 4 }
}

/** Whether a remote server address may be connected to; the check of registration, before the one every connection makes. */
export const isPublicEndpoint = async (url: string): Promise<boolean> => (await publicAddressOf(url)) !== null
