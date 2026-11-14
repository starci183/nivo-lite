/** The pages of a table held in memory: how many there are, and the rows of one. */
export interface TablePages<Row> {
    /** The page drawn, kept inside the pages that exist. */
    readonly page: number
    /** How many pages the rows fill. */
    readonly pageCount: number
    /** The rows of the page drawn. */
    readonly rows: ReadonlyArray<Row>
}

/** The rows of one page of a table; the whole rows when the table has no page size. */
export const pagesOf = <Row>(rows: ReadonlyArray<Row>, page: number, size: number | undefined): TablePages<Row> => {
    if (size === undefined) return { page: 1, pageCount: 1, rows }
    const pageCount = Math.max(1, Math.ceil(rows.length / size))
    const chosen = Math.min(Math.max(1, page), pageCount)
    return { page: chosen, pageCount, rows: rows.slice((chosen - 1) * size, chosen * size) }
}
