import { isIP } from "node:net"

/** True for loopback, private, link-local, unique-local and unspecified addresses (IPv4 and IPv6). */
export const isPrivateAddress = (address: string): boolean => {
    const a = address.toLowerCase().replace(/^\[|\]$/gu, "")
    if (isIP(a) === 6) {
        if (a === "::1" || a === "::") return true
        const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(a)
        if (mapped?.[1]) return isPrivateAddress(mapped[1])
        return /^(fc|fd|fe[89ab])/u.test(a)
    }
    const parts = a.split(".").map(Number)
    const [x = 0, y = 0] = parts
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true
    return (
        x === 0 ||
        x === 10 ||
        x === 127 ||
        (x === 169 && y === 254) ||
        (x === 172 && y >= 16 && y <= 31) ||
        (x === 192 && y === 168) ||
        (x === 100 && y >= 64 && y <= 127)
    )
}

/** Parses a raw address: the usable http(s) URL, or why the text cannot be a target. */
export const refusalOfText = (raw: string): { readonly url: URL } | { readonly reason: string } => {
    if (!URL.canParse(raw.trim())) return { reason: "url" }
    const url = new URL(raw.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") return { reason: "scheme" }
    if (url.username || url.password) return { reason: "credentials" }
    return { url }
}
