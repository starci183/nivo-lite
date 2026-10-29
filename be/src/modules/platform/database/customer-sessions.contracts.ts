/** One row a customer's server answers: the cells by their column name. */
export interface CustomerRow {
    /** The cells of the row, by column name. */
    readonly [column: string]: unknown
}

/** One read-only session to a customer's MySQL or SQL Server; closing it never throws. */
export interface CustomerSession {
    /** Runs one generated statement with positional text parameters and answers its rows. */
    query(text: string, params?: ReadonlyArray<string>): Promise<ReadonlyArray<CustomerRow>>
    /** Closes the session; never throws. */
    close(): Promise<void>
}
