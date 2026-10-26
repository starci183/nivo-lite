import { getTypeParser } from "pg-types"

/** The PostgreSQL type id of `date`. */
export const DATE_OID = 1082

/** The parser lookup the pg driver calls for each result column: an oid and a format to a cell parser. */
export interface PgTypeOverrides {
    /** The cell parser of one type in one format. */
    readonly getTypeParser: (oid: number, format?: "text" | "binary") => (value: string) => unknown
}

/** Whether the library's parser of one type is the cell parser it promises. */
const isCellParser = (value: unknown): value is (cell: string) => unknown => typeof value === "function"

/** The driver's own parser of one type in one format, as a callable of known shape. */
const driverParser = (oid: number, format?: "text" | "binary"): ((value: string) => unknown) => {
    const candidate: unknown = getTypeParser(oid, format)
    if (!isCellParser(candidate)) return (value: string) => value
    return (value: string): unknown => {
        const parsed: unknown = candidate(value)
        return parsed
    }
}

/**
 * The type parsers of the app's own connections: a `date` stays its `YYYY-MM-DD` text (the form every row type and rule
 * computes with) instead of becoming a Date at local midnight, which shifts the day in any zone east or west of UTC;
 * every other type keeps the driver's parser. It is set per connection, so a customer database read by the data sources
 * keeps the driver defaults.
 */
export const appPgTypes = (): PgTypeOverrides => ({
    getTypeParser: (oid, format) =>
        oid === DATE_OID && format !== "binary" ? (value: string) => value : driverParser(oid, format),
})
