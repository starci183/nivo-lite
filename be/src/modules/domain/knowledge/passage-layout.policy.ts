import { chunkLocated } from "@modules/domain/knowledge-chunks"
import type { LocatedText, PassagePlace } from "@modules/domain/knowledge-chunks"

/** The passages of a text in order, each with the place it sits at, and the places to write on the passages already stored. */
export interface PassageLayout {
    /** The passages in order. */
    readonly located: ReadonlyArray<LocatedText>
    /** The place of every passage by order when the file names places, else empty: a file with none leaves the stored places alone. */
    readonly places: ReadonlyArray<{ readonly order: number; readonly place: PassagePlace | null }>
}

/**
 * Cuts a text into passages. A file that names its places (the pages of a PDF, the slides of a presentation, the sheets of a workbook) is
 * cut stretch by stretch so no passage crosses a place; any other text is one stretch with none.
 */
export const layoutOf = (content: string, parts: ReadonlyArray<LocatedText> | undefined): PassageLayout => {
    const located = chunkLocated(parts ?? [{ place: null, text: content }])
    return {
        located,
        places: parts === undefined ? [] : located.map((piece, order) => ({ order, place: piece.place })),
    }
}
