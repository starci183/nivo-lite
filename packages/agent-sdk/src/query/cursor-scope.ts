/** One 53-bit string hash (cyrb53) of the UTF-8 bytes of the text under a seed: pure, synchronous, the same in a browser and on a server. */
const hash53 = (text: string, seed: number): number => {
    const [first, second] = new TextEncoder()
        .encode(text)
        .reduce<readonly [number, number]>(
            ([high, low], byte) => [Math.imul(high ^ byte, 2654435761), Math.imul(low ^ byte, 1597334677)],
            [0xdeadbeef ^ seed, 0x41c6ce57 ^ seed],
        )
    const mixedFirst = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909)
    const mixedSecond =
        Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(mixedFirst ^ (mixedFirst >>> 13), 3266489909)
    return 4294967296 * (2097151 & mixedSecond) + (mixedFirst >>> 0)
}

/** Filter names are record keys, so two never equal: the order is by code unit, the same everywhere. */
const byName = (left: readonly [string, string], right: readonly [string, string]): number =>
    left[0] < right[0] ? -1 : 1

/**
 * The scope of a keyset cursor: a hash of the read name, the chosen filters and the sort, so a cursor minted for one list is
 * refused on another. Pure; the signing that binds it to a cursor lives in the back end. The workspace is never part of it.
 */
export const cursorScopeOf = (read: string, filters: Readonly<Record<string, string>>, sort: string): string => {
    const canonical = JSON.stringify([read, sort, Object.entries(filters).sort(byName)])
    return [0, 1].map((seed) => hash53(canonical, seed).toString(16).padStart(14, "0")).join("")
}
