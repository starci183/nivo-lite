import { isRecord } from "@modules/platform/primitives"

/** One suppressed message as the development outbox keeps it. */
export interface OutboxEntry {
    /** When the message was held, ISO 8601. */
    readonly at: string
    /** The recipient. */
    readonly to: string
    /** The subject. */
    readonly subject: string
    /** The plain-text body. */
    readonly text: string
    /** The web links of the body, in order (a confirmation or reset link). */
    readonly links: ReadonlyArray<string>
}

const LINK = /https?:\/\/[^\s<>"]+/gu
const TRAILING = /[.,;:)\]]+$/u

/** The web links of a text, in order, without the punctuation that ends a sentence. */
export const linksOf = (text: string): ReadonlyArray<string> =>
    (text.match(LINK) ?? []).map((link) => link.replace(TRAILING, ""))

/** The entry of a held message. */
export const outboxEntryOf = (at: Date, to: string, subject: string, text: string): OutboxEntry => ({
    at: at.toISOString(),
    to,
    subject,
    text,
    links: linksOf(text),
})

/** The entry a stored document is, or undefined when it is not one. */
export const parseOutboxEntry = (document: unknown): OutboxEntry | undefined => {
    if (!isRecord(document)) return undefined
    const { at, to, subject, text, links } = document
    if (typeof at !== "string" || typeof to !== "string" || typeof subject !== "string" || typeof text !== "string") {
        return undefined
    }
    if (!Array.isArray(links)) return undefined
    return { at, to, subject, text, links: links.filter((link): link is string => typeof link === "string") }
}

/** What the operator asked of the outbox. */
export interface OutboxQuery {
    /** Only the messages to this address (case-insensitive). */
    readonly to?: string | undefined
    /** Only the newest message of the rest. */
    readonly latest?: boolean | undefined
}

/** The entries an operator asked for, oldest first; `latest` keeps the newest one. */
export const selectEntries = (entries: ReadonlyArray<OutboxEntry>, query: OutboxQuery): ReadonlyArray<OutboxEntry> => {
    const wanted = query.to?.trim().toLowerCase()
    const matching = [...entries]
        .filter((entry) => wanted === undefined || entry.to.toLowerCase() === wanted)
        .sort((left, right) => left.at.localeCompare(right.at))
    return query.latest === true ? matching.slice(-1) : matching
}
