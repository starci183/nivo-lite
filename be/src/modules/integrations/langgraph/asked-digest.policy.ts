import { createHash } from "node:crypto"

/** A value as text that is the same for the same content, whatever order its members were set in; an absent member is no member. */
export const stableText = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map((item) => stableText(item)).join(",")}]`
    if (typeof value !== "object" || value === null) return JSON.stringify(value) ?? "null"
    const members = Object.entries(value)
        .filter(([, member]) => member !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : 1))
    return `{${members.map(([key, member]) => `${JSON.stringify(key)}:${stableText(member)}`).join(",")}}`
}

/**
 * What tells one model call from another: a digest of everything it was asked with. Two calls with other content (a founder's
 * answer, a new customer line, another tool fact) have two digests; the same content always has the same one, in any process.
 *
 * @param asked - What the call was asked with, plain data.
 * @returns 32 hex characters.
 */
export const digestOf = (asked: unknown): string => createHash("sha256").update(stableText(asked)).digest("hex").slice(0, 32)
