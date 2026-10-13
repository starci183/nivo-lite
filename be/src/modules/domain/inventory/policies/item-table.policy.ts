import type { ImportRow, ParsedItemTable } from "../inventory.contracts"
import { foldText, parseNumber } from "./number-format.policy"

type FieldKey =
    | "sku"
    | "name"
    | "unit"
    | "category"
    | "costVnd"
    | "sellPriceVnd"
    | "reorderPoint"
    | "reorderQty"
    | "qty"
    | "supplier"

interface FieldHeaders {
    readonly field: FieldKey
    readonly headers: ReadonlyArray<string>
}

/** The folded header names that map a pasted column to a field. */
const FIELD_HEADERS: ReadonlyArray<FieldHeaders> = [
    { field: "sku", headers: ["ma", "ma hang", "sku", "ma sp", "ma vat tu"] },
    { field: "name", headers: ["ten", "ten hang", "ten hang hoa", "name", "san pham", "ten vat tu", "ten sp"] },
    { field: "unit", headers: ["don vi", "dvt", "unit", "don vi tinh"] },
    { field: "category", headers: ["nhom", "loai", "danh muc", "category", "nhom hang"] },
    { field: "costVnd", headers: ["gia von", "gia nhap", "don gia", "cost", "gia mua"] },
    { field: "sellPriceVnd", headers: ["gia ban", "gia", "price", "sell"] },
    {
        field: "reorderPoint",
        headers: ["ton toi thieu", "muc toi thieu", "toi thieu", "min", "diem dat hang", "reorder"],
    },
    { field: "reorderQty", headers: ["so luong nhap", "luong nhap", "nhap moi lan", "reorder qty", "so luong dat"] },
    { field: "qty", headers: ["ton", "ton kho", "so luong", "ton dau", "qty", "ton hien tai"] },
    { field: "supplier", headers: ["nha cung cap", "ncc", "supplier", "nguon"] },
]

/** The column order of a table without a header row. */
const DEFAULT_ORDER: ReadonlyArray<FieldKey> = [
    "sku",
    "name",
    "unit",
    "category",
    "costVnd",
    "sellPriceVnd",
    "reorderPoint",
    "reorderQty",
    "qty",
    "supplier",
]

/** How many header cells must be recognised before the first row counts as a header. */
const HEADER_MIN_MATCHES = 2

/** The longest SKU derived from a name. */
const DERIVED_SKU_MAX = 24

const splitCells = (line: string): Array<string> => {
    let separator = ","
    if (line.includes("\t")) separator = "\t"
    else if (line.includes(";")) separator = ";"
    const cells: Array<string> = []
    let current = ""
    let quoted = false
    for (const char of line) {
        if (char === '"') quoted = !quoted
        else if (char === separator && !quoted) {
            cells.push(current.trim())
            current = ""
        } else current += char
    }
    cells.push(current.trim())
    return cells
}

const fieldOfHeader = (header: string): FieldKey | null =>
    FIELD_HEADERS.find((entry) => entry.headers.includes(header))?.field ?? null

/**
 * Reads pasted rows from a sheet or CSV. A first row that names columns maps them; otherwise the order is sku, name,
 * unit, category, cost, price, minimum, order quantity, stock, supplier. A row without a name is skipped.
 */
export const parseItemTable = (text: string, defaultUnit: string): ParsedItemTable => {
    const lines = text
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line !== "")
    const firstLine = lines[0]
    if (firstLine === undefined) return { rows: [], skipped: [] }
    const mapped = splitCells(firstLine).map((cell) => fieldOfHeader(foldText(cell)))
    const hasHeader = mapped.filter((field) => field !== null).length >= HEADER_MIN_MATCHES
    const order: ReadonlyArray<FieldKey | null> = hasHeader ? mapped : DEFAULT_ORDER
    const rows: Array<ImportRow> = []
    const skipped: Array<string> = []
    for (const line of hasHeader ? lines.slice(1) : lines) {
        const cells = splitCells(line)
        const cell = (field: FieldKey): string => cells[order.indexOf(field)] ?? ""
        const name = cell("name")
        if (name === "") {
            skipped.push(line)
            continue
        }
        const price = cell("sellPriceVnd")
        const qty = cell("qty")
        rows.push({
            sku: cell("sku"),
            name,
            unit: cell("unit") || defaultUnit,
            category: cell("category"),
            costVnd: Math.max(0, parseNumber(cell("costVnd"))),
            sellPriceVnd: price === "" ? null : Math.max(0, parseNumber(price)),
            reorderPoint: Math.max(0, parseNumber(cell("reorderPoint"))),
            reorderQty: Math.max(0, parseNumber(cell("reorderQty"))),
            qty: qty === "" ? null : parseNumber(qty),
            supplier: cell("supplier"),
        })
    }
    return { rows, skipped }
}

/** A short stable SKU from a name when the sheet has none: the first four words, upper case, dashed. */
export const skuFromName = (name: string): string =>
    foldText(name).split(" ").filter(Boolean).slice(0, 4).join("-").toUpperCase().slice(0, DERIVED_SKU_MAX) || "ITEM"
