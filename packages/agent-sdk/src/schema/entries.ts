/**
 * A refinement for a zod record: it holds at most `limit` entries. zod bounds a string or a list by itself, a record only by a
 * refinement on its entry count.
 */
export const entriesAtMost =
    (limit: number): ((entries: Readonly<Record<string, unknown>>) => boolean) =>
    (entries) =>
        Object.keys(entries).length <= limit
