/** The patterns that apply when `MAIL_SUPPRESS` is not set: the documentation and reserved domains no real mailbox lives on. */
export const DEFAULT_SUPPRESS = "*.example.test,*.example.com,*.invalid"

/** The patterns of a comma-separated list: trimmed, lower case, blanks dropped. */
export const parseSuppressList = (text: string): ReadonlyArray<string> =>
    text
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry !== "")

const matches = (pattern: string, address: string, domain: string): boolean => {
    if (pattern.includes("@")) return pattern === address
    if (pattern.startsWith("*.")) {
        const base = pattern.slice(2)
        return domain === base || domain.endsWith(`.${base}`)
    }
    return pattern === domain
}

/**
 * True when the address matches a pattern of the list, case-insensitively. A pattern with an `@` is one exact address; `*.example.test`
 * is the domain `example.test` and every subdomain of it; a bare `example.test` is that domain alone.
 */
export const isSuppressed = (patterns: ReadonlyArray<string>, address: string): boolean => {
    const lower = address.trim().toLowerCase()
    const domain = lower.slice(lower.lastIndexOf("@") + 1)
    return patterns.some((pattern) => matches(pattern, lower, domain))
}

/** The address with its local part hidden after the first character, so a log line never carries a mailbox. */
export const maskAddress = (address: string): string => {
    const at = address.lastIndexOf("@")
    return at < 1 ? "***" : `${address.slice(0, 1)}***${address.slice(at)}`
}
