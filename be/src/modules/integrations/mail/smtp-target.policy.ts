import { isIP } from "node:net"

/** The ports a public mail server listens on. */
export const PUBLIC_MAIL_PORTS: ReadonlySet<number> = new Set([25, 465, 587, 2465, 2525, 2587])

const HOST_SYNTAX = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/iu

/** True for loopback, private, link-local, unique-local and unspecified addresses, IPv4 and IPv6. */
export const isPrivateAddress = (address: string): boolean => {
    const bare = address.toLowerCase().replace(/^\[|\]$/gu, "")
    if (isIP(bare) === 6) {
        if (bare === "::1" || bare === "::") return true
        const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(bare)
        return mapped?.[1] === undefined ? /^(fc|fd|fe[89ab])/u.test(bare) : isPrivateAddress(mapped[1])
    }
    const parts = bare.split(".").map(Number)
    const [first, second] = parts
    if (
        parts.length !== 4 ||
        parts.some((part) => !Number.isInteger(part)) ||
        first === undefined ||
        second === undefined
    ) {
        return true
    }
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

/** True when the host is a well-formed DNS name or an address (no spaces, no consecutive dots). */
export const isWellFormedHost = (host: string): boolean => HOST_SYNTAX.test(host) && !host.includes("..")

/** True when the port is a valid TCP port. */
export const isValidPort = (port: number): boolean => Number.isInteger(port) && port >= 1 && port <= 65535
