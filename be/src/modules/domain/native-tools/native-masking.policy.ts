/** The most characters of a channel id that stay visible in all, and the share of the id they may be. */
const VISIBLE_MAX = 7
const VISIBLE_SHARE = 0.3

/** The mark between the visible ends of a masked id. */
const GAP = "…"

/** The text shortened to `max` characters with an ellipsis. */
export const clipped = (text: string, max: number): string =>
    text.length > max ? `${text.slice(0, max - 1).trimEnd()}${GAP}` : text

/**
 * A customer's id on a channel as a tool answers it: its first and last characters with a gap between, as the console draws it, but
 * never more than 30 percent of the id in all (and seven at most), so a short id hides most of itself. An id too short to hide
 * anything shows nothing, and a conversation with no id gives an empty text.
 */
export const customerMasked = (externalId: string | null): string => {
    if (externalId === null) return ""
    const text = externalId.trim()
    const visible = Math.min(VISIBLE_MAX, Math.floor(text.length * VISIBLE_SHARE))
    if (visible < 2) return ""
    const head = Math.ceil(visible * 0.6)
    return `${text.slice(0, head)}${GAP}${text.slice(text.length - (visible - head))}`
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
