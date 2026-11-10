/** A row of cells with a key that stays the same for the same row. */
export interface KeyedRow {
    /** The cells joined, told apart from an identical row by how many come before it. */
    readonly key: string
    /** The cells of the row. */
    readonly cells: ReadonlyArray<string>
}

/** The rows with a stable key each: the cells, then the count of identical rows before it, so a list drawn from them has no index key. */
export const keyedRows = (rows: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<KeyedRow> =>
    rows.reduce<ReadonlyArray<KeyedRow>>((keyed, cells) => {
        const text = cells.join("|")
        const seen = keyed.filter((row) => row.cells.join("|") === text).length
        return [...keyed, { key: `${text}#${seen}`, cells }]
    }, [])
