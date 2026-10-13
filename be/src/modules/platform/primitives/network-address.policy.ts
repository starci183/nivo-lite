import { isIP } from "node:net"

const HOST_SYNTAX = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/iu
const MAPPED_V4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u
const UNIQUE_LOCAL_OR_LINK_LOCAL = /^(fc|fd|fe[89ab])/u

/** True for loopback, private, link-local, unique-local, shared (CGNAT), metadata and unspecified addresses, IPv4 and IPv6. */
export const isPrivateAddress = (address: string): boolean => {
    const bare = address.toLowerCase().replace(/^\[|\]$/gu, "")
    if (isIP(bare) === 6) {
        if (bare === "::1" || bare === "::") return true
        const mapped = MAPPED_V4.exec(bare)
        return mapped?.[1] === undefined ? UNIQUE_LOCAL_OR_LINK_LOCAL.test(bare) : isPrivateAddress(mapped[1])
    }
    const [first, second, third, fourth] = bare.split(".").map(Number)
    if (first === undefined || second === undefined || third === undefined || fourth === undefined) return true
    if (![first, second, third, fourth].every((part) => Number.isInteger(part))) return true
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

/** True when the host is a well-formed DNS name (letters, digits, dots and dashes, no consecutive dots). */
export const isWellFormedHost = (host: string): boolean => HOST_SYNTAX.test(host) && !host.includes("..")
