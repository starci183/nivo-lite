/** The stable identifier each behavioral scenario exposes to the test report. */
interface NamedCase {
    /** The scenario identifier. */
    readonly id: string
}

/** The rows of a table as `it.each` takes them: the id names the test, the row is the argument. */
export const tableOf = <Row extends NamedCase>(rows: ReadonlyArray<Row>): Array<[string, Row]> =>
    rows.map((row): [string, Row] => [row.id, row])
