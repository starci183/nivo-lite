import type { Table } from "@modules/integrations/data-sources"
import type { CsvColumnKind, CsvConfig, CsvEntity, CsvMapping } from "./csv-import.contracts"
import { fold, parseDateLoose, parseNumberLoose } from "./csv-import-values.policy"

const PHONE = ["sdt", "so dien thoai", "dien thoai", "phone", "mobile", "tel", "zalo", "hotline", "di dong"]
const EMAIL = ["email", "mail", "thu dien tu"]
const NAME = [
    "ho ten",
    "ho va ten",
    "ten khach hang",
    "ten khach",
    "khach hang",
    "ten",
    "name",
    "full name",
    "customer",
    "customer name",
    "fullname",
]
const CODE = [
    "ma",
    "id",
    "code",
    "sku",
    "ma so",
    "stt",
    "barcode",
    "mst",
    "cccd",
    "ma khach hang",
    "ma kh",
    "ma don",
    "ma don hang",
    "ma san pham",
    "order id",
    "ma giao dich",
]
const DATE = ["ngay", "date", "thoi gian", "time", "created", "ngay tao", "ngay sinh", "created at"]
const PRODUCT_NAME = ["ten san pham", "ten hang", "san pham", "product", "product name", "ten hang hoa", "ten"]
const ORDER_TITLE = ["ma don", "ma don hang", "order", "order id", "ten khach hang", "khach hang"]

const hasWord = (folded: string, words: ReadonlyArray<string>): boolean =>
    words.some((word) => ` ${folded} `.includes(` ${word} `))

const find = (headers: ReadonlyArray<string>, words: ReadonlyArray<string>, exact = false): string | null => {
    for (const word of words) {
        const header = headers.find((candidate) =>
            exact ? fold(candidate) === word : hasWord(fold(candidate), [word]),
        )
        if (header !== undefined) return header
    }
    return null
}

const detectKind = (header: string, values: ReadonlyArray<string>): CsvColumnKind => {
    const folded = fold(header)
    if (hasWord(folded, PHONE)) return "phone"
    if (hasWord(folded, EMAIL)) return "email"
    const filled = values.filter(Boolean).slice(0, 200)
    if (filled.length === 0) return "text"
    const isCode = hasWord(folded, CODE) || (/^(ma|so)\b/u.test(folded) && !/(luong|tien|gia)/u.test(folded))
    const dates = filled.filter((value) => parseDateLoose(value) !== null).length
    if (dates / filled.length >= 0.8) return "date"
    if (hasWord(folded, DATE) && dates / filled.length >= 0.5) return "date"
    if (!isCode) {
        const numbers = filled.filter((value) => parseNumberLoose(value) !== null && !/^0\d/u.test(value.trim())).length
        if (numbers === filled.length) return "number"
    }
    return "text"
}

/** A first guess at which columns are the id, the title and the date, and how each column should be read. */
export const suggestMapping = (table: Pick<Table, "headers" | "rows">, entity: CsvEntity): CsvMapping => {
    const { headers, rows } = table
    const kinds: Record<string, CsvColumnKind> = {}
    headers.forEach((header, index) => {
        kinds[header] = detectKind(
            header,
            rows.slice(0, 200).map((row) => row[index] ?? ""),
        )
    })
    const phone = headers.find((header) => kinds[header] === "phone") ?? null
    const email = headers.find((header) => kinds[header] === "email") ?? null
    const code = find(headers, CODE, true) ?? headers.find((header) => /^(ma|id|sku)\b/u.test(fold(header))) ?? null
    const idColumn = entity === "customer" ? (code ?? email ?? phone) : code
    let titleWords = NAME
    if (entity === "product") titleWords = PRODUCT_NAME
    else if (entity === "order") titleWords = ORDER_TITLE
    const titleColumn =
        find(headers, titleWords) ??
        headers.find((header) => kinds[header] === "text" && header !== idColumn) ??
        headers[0] ??
        null
    const dates = headers.filter((header) => kinds[header] === "date")
    const dateColumn = find(dates, DATE) ?? dates[0] ?? null
    return { idColumn, titleColumn, dateColumn, kinds, columns: headers }
}

/** The saved mapping carried over to new data: columns the data still has are kept, the others fall back to a fresh guess. */
export const carryMapping = (saved: CsvConfig, table: Pick<Table, "headers" | "rows">): CsvMapping => {
    const fresh = suggestMapping(table, saved.entity)
    const keep = (column: string | null): string | null =>
        column !== null && table.headers.includes(column) ? column : null
    return {
        idColumn: keep(saved.idColumn) ?? (saved.idColumn === null ? null : fresh.idColumn),
        titleColumn: keep(saved.titleColumn) ?? fresh.titleColumn,
        dateColumn: keep(saved.dateColumn) ?? (saved.dateColumn === null ? null : fresh.dateColumn),
        kinds: Object.fromEntries(
            table.headers.map((header) => [header, saved.kinds[header] ?? fresh.kinds[header] ?? "text"]),
        ),
        columns: table.headers,
    }
}
