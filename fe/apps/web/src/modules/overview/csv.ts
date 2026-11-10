import Papa from "papaparse"

/** One cell of the report. */
export type CsvCell = string | number

/** The byte-order mark that makes a spreadsheet read the file as UTF-8 (Vietnamese letters survive). */
const BYTE_ORDER_MARK = "\uFEFF"

/** The text of the report file: the rows quoted where they need it, led by the byte-order mark. */
export const csvTextOf = (rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string =>
    BYTE_ORDER_MARK + Papa.unparse(rows.map((row) => [...row]))
