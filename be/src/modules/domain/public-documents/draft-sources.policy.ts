import type { DraftSource, InternalText } from "./public-documents.contracts"

/**
 * The most characters of document text one draft call is shown, across all its sources. Each source gets an equal share, so a long
 * first document does not hide the others; the text beyond a source's share is not shown, never written from, and no second call is
 * made for it (the source says `cut: true`, logged by the run).
 */
export const MAX_SHOWN_CHARS = 20_000

/** A text cut to at most `limit` characters, at the last line break or space before the bound when there is one. */
const cutAt = (text: string, limit: number): string => {
    const head = text.slice(0, limit)
    const at = Math.max(head.lastIndexOf("\n"), head.lastIndexOf(" "))
    return (at > 0 ? head.slice(0, at) : head).trimEnd()
}

/** The public-area documents as one draft call shows them: each within its share of `MAX_SHOWN_CHARS`. Nothing here reads meaning. */
export const shownSourcesOf = (texts: ReadonlyArray<InternalText>): ReadonlyArray<DraftSource> => {
    const share = texts.length === 0 ? 0 : Math.floor(MAX_SHOWN_CHARS / texts.length)
    return texts.map((source) => {
        const text = source.text.trim()
        const cut = text.length > share
        return { sourceId: source.sourceId, title: source.title, text: cut ? cutAt(text, share) : text, cut }
    })
}
