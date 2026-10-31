/** How many characters of a channel id stay visible at its start and at its end. */
const CHANNEL_HEAD = 4
const CHANNEL_TAIL = 3

/** The mark between the visible ends of a masked id. */
const GAP = "…"

/** The text shortened to `max` characters with an ellipsis. */
export const clipped = (text: string, max: number): string =>
    text.length > max ? `${text.slice(0, max - 1).trimEnd()}${GAP}` : text

/**
 * A customer's id on a channel as a tool answers it: the first four and the last three characters, as the console draws it. An id too
 * short to hide anything shows nothing, and a conversation with no id gives an empty text.
 */
export const customerMasked = (externalId: string | null): string => {
    if (externalId === null) return ""
    const text = externalId.trim()
    if (text.length <= CHANNEL_HEAD + CHANNEL_TAIL) return ""
    return `${text.slice(0, CHANNEL_HEAD)}${GAP}${text.slice(-CHANNEL_TAIL)}`
}

/** An email with the local part masked down to its first character: `l***@shop.vn`; a text with no domain shows nothing. */
export const emailMasked = (email: string | null): string => {
    if (email === null) return ""
    const at = email.lastIndexOf("@")
    if (at < 1) return ""
    return `${email.slice(0, 1)}***${email.slice(at)}`
}

/**
 * Whether a connection needs the owner: it is not connected, or its last failure is still recorded. A boolean, so the raw error
 * text of a provider never leaves.
 */
export const needsAttention = (status: string, lastError: string | null): boolean =>
    status !== "connected" || (lastError !== null && lastError.trim() !== "")

/** The instant a database words in text, as ISO 8601; empty when the text is not an instant. */
export const isoOf = (text: string): string => {
    const at = new Date(text)
    return Number.isNaN(at.getTime()) ? "" : at.toISOString()
}
