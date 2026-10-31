import type { ChunkMove, EmbeddedChunk, MissingPassage, ReusePlan } from "./knowledge-chunks.contracts"
import { passageHashOf } from "./passage-hash.policy"

/** A piece of the text, wanted at its order. */
interface Wanted extends MissingPassage {
    /** What a stored passage must carry to serve it. */
    readonly hash: string
}

/** Whether a stored passage already is the piece at its order; one with no hash is compared as text, as it was before hashes. */
const isInPlace = (row: EmbeddedChunk, piece: Wanted, model: string): boolean =>
    row.hash === null ? row.model === model && row.text === piece.text : row.hash === piece.hash

/** The stored passages nothing uses yet, by hash; a passage with no hash is never moved. */
const freeByHash = (stored: ReadonlyArray<EmbeddedChunk>, stays: ReadonlySet<EmbeddedChunk>) => {
    const free = new Map<string, Array<EmbeddedChunk>>()
    for (const row of stored) {
        if (row.hash === null || stays.has(row)) continue
        free.set(row.hash, [...(free.get(row.hash) ?? []), row])
    }
    return free
}

/**
 * Which stored vectors the pieces of a text can use: a stored passage stays when it already is the piece at its order, and moves when
 * the piece sits elsewhere, looked up by hash whatever the position. A stored passage serves one piece, so a duplicate piece is embedded.
 * What is left is embedded; a stored passage nothing uses is replaced where the new passages land.
 */
export const reusePlanOf = (
    pieces: ReadonlyArray<string>,
    stored: ReadonlyArray<EmbeddedChunk>,
    model: string,
): ReusePlan => {
    const wanted = pieces.map((text, order): Wanted => ({ text, order, hash: passageHashOf(text, model) }))
    const atOrder = new Map(stored.map((row) => [row.order, row]))
    const inPlace = (piece: Wanted): EmbeddedChunk | undefined => {
        const row = atOrder.get(piece.order)
        return row !== undefined && isInPlace(row, piece, model) ? row : undefined
    }
    const free = freeByHash(stored, new Set(wanted.flatMap((piece) => inPlace(piece) ?? [])))
    const moves: Array<ChunkMove> = []
    const missing: Array<MissingPassage> = []
    for (const piece of wanted) {
        if (inPlace(piece) !== undefined) continue
        const row = free.get(piece.hash)?.shift()
        if (row === undefined) missing.push({ order: piece.order, text: piece.text })
        else moves.push({ id: row.id, order: piece.order })
    }
    return { moves, missing }
}
