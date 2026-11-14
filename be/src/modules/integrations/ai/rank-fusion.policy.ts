/** The constant of reciprocal rank fusion: the usual 60, which keeps one leg's first place from outweighing two good places. */
export const FUSION_K = 60

/** One item of a fused ranking. */
export interface Fused {
    /** The item. */
    readonly id: string
    /** The fused score, higher first. */
    readonly score: number
    /** Its rank in each list, from 1, in the order the lists were given; null where a list does not hold it. */
    readonly ranks: ReadonlyArray<number | null>
}

/** What one place of an id in one of the fused lists is worth (1 is a plain place): by the list's position and the id. */
export type FusionWeight = (list: number, id: string) => number

/** The best score an item can reach across `lists` rankings: first place in every one. */
export const topScoreOf = (lists: number, k: number = FUSION_K): number => lists / (k + 1)

/**
 * Reciprocal rank fusion of several rankings of ids (each best first): an item scores `weight / (k + rank)` in every list that
 * holds it, summed (weight 1 unless `weightOf` says otherwise). It reads RANKS, never the legs' own scores, so a word rank and a
 * vector distance need no common scale. The order is total and repeatable: score first, then the id.
 *
 * @param lists - The rankings, each best first; an id counts once per list (its first place).
 * @param k - The fusion constant.
 * @param weightOf - What one place of an id in a list is worth, by the list's position and the id; 1 when absent.
 * @returns Every id of any list, best first.
 */
export const fuseRanks = (
    lists: ReadonlyArray<ReadonlyArray<string>>,
    k: number = FUSION_K,
    weightOf: FusionWeight = () => 1,
): ReadonlyArray<Fused> => {
    const ranks = new Map<string, Array<number | null>>()
    lists.forEach((list, at) => {
        list.forEach((id, index) => {
            const own = ranks.get(id) ?? lists.map(() => null)
            own[at] ??= index + 1
            ranks.set(id, own)
        })
    })
    return [...ranks.entries()]
        .map(([id, own]): Fused => ({
            id,
            ranks: own,
            score: own.reduce<number>(
                (sum, rank, list) => sum + (rank === null ? 0 : weightOf(list, id) / (k + rank)),
                0,
            ),
        }))
        .toSorted((left, right) => right.score - left.score || left.id.localeCompare(right.id))
}
