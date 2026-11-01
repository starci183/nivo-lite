/** What the `origin` of the later parts of a long document starts with; the rest is the id of the first part's source. */
const PART_ORIGIN_PREFIX = "part:"

/** The title suffix a part carries: ` (2/3)`, with its place captured. */
const PART_SUFFIX = / \((\d{1,4})\/\d{1,4}\)$/u

/** The id of the first part's source when `origin` marks a later part of a long document, else null. */
export const firstPartIdOf = (origin: string | null): string | null =>
    origin?.startsWith(PART_ORIGIN_PREFIX) === true ? origin.slice(PART_ORIGIN_PREFIX.length) : null

/** The place of a part counted from 1 as its title says it, or null when the title carries no place. */
export const partPlaceOf = (title: string): number | null => {
    const place = PART_SUFFIX.exec(title)?.[1]
    return place === undefined ? null : Number(place)
}

/** The title of a document without the place of its part: ` (1/3)` is dropped. */
export const wholeTitleOf = (title: string): string => title.replace(PART_SUFFIX, "").trim()

/** The texts of later parts in the order of their places, so two readings of the same document compare part by part. */
export const partTextsInOrder = (
    parts: ReadonlyArray<{ readonly title: string; readonly content: string }>,
): ReadonlyArray<string> =>
    [...parts]
        .sort((left, right) => (partPlaceOf(left.title) ?? 0) - (partPlaceOf(right.title) ?? 0))
        .map((part) => part.content)

/** The origin the later parts of the document `sourceId` carry, so they are found again to be replaced or removed with it. */
export const partOriginOf = (sourceId: string): string => `${PART_ORIGIN_PREFIX}${sourceId}`

/** The title of part `position` (counted from 1) of `total`: the document's own title and the place of the part. */
export const partTitleOf = (title: string, position: number, total: number): string =>
    `${title.replace(PART_SUFFIX, "").trim().slice(0, 140)} (${position}/${total})`

/**
 * A long text cut into parts of at most `max` characters, at line ends so a row of a table or a paragraph is never split; a single
 * line longer than `max` is cut where it must be. A text that fits is one part, unchanged.
 */
export const partsOf = (text: string, max: number): ReadonlyArray<string> => {
    if (text.length <= max) return [text]
    const parts: Array<string> = []
    let current: Array<string> = []
    let size = 0
    const close = () => {
        const part = current.join("\n").trim()
        if (part !== "") parts.push(part)
        current = []
        size = 0
    }
    for (const line of text.split("\n")) {
        for (let from = 0; from === 0 || from < line.length; from += max) {
            const piece = line.slice(from, from + max)
            if (size > 0 && size + 1 + piece.length > max) close()
            current.push(piece)
            size += (size > 0 ? 1 : 0) + piece.length
        }
    }
    close()
    return parts
}
