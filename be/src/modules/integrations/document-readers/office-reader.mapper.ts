import { strFromU8, unzipSync } from "fflate"
import { DocumentWarningCode } from "./document-readers.contracts"
import type { DocumentPage, DocumentTable, DocumentWarning } from "./document-readers.contracts"
import { decodeEntities } from "./html-reader.mapper"
import { tableOf, tableText } from "./text-reader.mapper"

/** The largest part of an Office archive that is inflated: a larger one is left packed (a zip bomb never inflates). */
const MAX_PART_BYTES = 60_000_000

/** The letters of a spreadsheet column, in order. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/** The built-in number formats of Excel that show a date. */
const DATE_FORMATS: ReadonlySet<number> = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57])

/** Milliseconds in a day. */
const DAY_MS = 86_400_000

/** The day Excel counts dates from (its 1900 system, with its leap-year slip folded in). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)

/** The parts of an Office archive whose names pass `wanted`, inflated, as text. */
export const officeParts = (bytes: Uint8Array, wanted: (name: string) => boolean): Map<string, string> => {
    const files = unzipSync(bytes, {
        filter: (file) => wanted(file.name) && file.originalSize <= MAX_PART_BYTES,
    })
    return new Map(Object.entries(files).map(([name, data]) => [name, strFromU8(data)]))
}

/** One XML attribute of a tag's text, entities written out, or "" when it is absent. */
const attribute = (tag: string, name: string): string => {
    const match = new RegExp(`\\s${name}="([^"]*)"`, "u").exec(tag)
    return decodeEntities(match?.[1] ?? "")
}

/** The text runs (`<t>` or `<a:t>`) of a piece of XML, joined. */
const runsOf = (xml: string, tag: string): string =>
    [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gu"))]
        .map((run) => decodeEntities(run[1] ?? ""))
        .join("")

/** The column index (from 0) of a cell reference such as `C7`. */
const columnOf = (ref: string): number => {
    const letters = /^[A-Z]+/u.exec(ref)?.[0] ?? ""
    return [...letters].reduce((total, letter) => total * 26 + ALPHABET.indexOf(letter) + 1, 0) - 1
}

/** The shared strings of a workbook, in order. */
const sharedStringsOf = (xml: string | undefined): Array<string> =>
    xml === undefined ? [] : [...xml.matchAll(/<si>([\s\S]*?)<\/si>/gu)].map((item) => runsOf(item[1] ?? "", "t"))

/** For each cell style (by index), whether it shows a date. */
const dateStylesOf = (xml: string | undefined): Array<boolean> => {
    if (xml === undefined) return []
    const custom = new Map<number, string>(
        [...xml.matchAll(/<numFmt\b[^>]*>/gu)].map((tag) => [
            Number(attribute(tag[0], "numFmtId")),
            attribute(tag[0], "formatCode"),
        ]),
    )
    const cellXfs = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/u.exec(xml)?.[1] ?? ""
    return [...cellXfs.matchAll(/<xf\b[^>]*>/gu)].map((tag) => {
        const id = Number(attribute(tag[0], "numFmtId"))
        if (DATE_FORMATS.has(id)) return true
        const code = (custom.get(id) ?? "").replace(/"[^"]*"|\[[^\]]*\]/gu, "").toLowerCase()
        return /[dy]/u.test(code) && !/[#0]/u.test(code)
    })
}

/** A date serial of Excel written as day/month/year. */
const dateText = (serial: number): string => {
    const date = new Date(EXCEL_EPOCH_MS + Math.round(serial * DAY_MS))
    const day = String(date.getUTCDate()).padStart(2, "0")
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    return `${day}/${month}/${date.getUTCFullYear()}`
}

/** What a workbook's cells need to be read. */
interface CellBook {
    /** The shared strings. */
    readonly strings: ReadonlyArray<string>
    /** Whether each style shows a date. */
    readonly dates: ReadonlyArray<boolean>
}

/** The text of one cell. */
const cellValue = (cell: string, book: CellBook): string => {
    const open = /^<c\b[^>]*>/u.exec(cell)?.[0] ?? ""
    const type = attribute(open, "t")
    const value = decodeEntities(/<v>([\s\S]*?)<\/v>/u.exec(cell)?.[1] ?? "")
    if (type === "inlineStr") return runsOf(cell, "t")
    if (value === "") return ""
    if (type === "s") return book.strings[Number(value)] ?? ""
    if (type === "b") return value === "1" ? "TRUE" : "FALSE"
    if (type === "" || type === "n") {
        const style = Number(attribute(open, "s") || "0")
        const number = Number(value)
        if (Number.isFinite(number) && book.dates[style] === true) return dateText(number)
    }
    return value
}

/** The rows of one sheet, each cell at its column. */
const sheetRows = (xml: string, book: CellBook): Array<Array<string>> =>
    [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gu)].map((row) => {
        const cells: Array<string> = []
        for (const cell of (row[1] ?? "").matchAll(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/gu)) {
            const ref = attribute(cell[0].slice(0, cell[0].indexOf(">") + 1), "r")
            const at = ref === "" ? cells.length : columnOf(ref)
            while (cells.length < at) cells.push("")
            cells[at] = cellValue(cell[0], book)
        }
        return cells
    })

/** The sheets of a workbook in their order, with the archive path of each. */
const sheetsOf = (parts: ReadonlyMap<string, string>): Array<{ readonly name: string; readonly path: string }> => {
    const targets = new Map(
        [...(parts.get("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b[^>]*>/gu)].map((tag) => [
            attribute(tag[0], "Id"),
            attribute(tag[0], "Target"),
        ]),
    )
    return [...(parts.get("xl/workbook.xml") ?? "").matchAll(/<sheet\b[^>]*>/gu)].map((tag, index) => {
        const target = targets.get(attribute(tag[0], "r:id")) ?? `worksheets/sheet${index + 1}.xml`
        return {
            name: attribute(tag[0], "name") || `Sheet${index + 1}`,
            path: target.startsWith("/") ? target.slice(1) : `xl/${target}`,
        }
    })
}

/** A workbook read sheet by sheet: each sheet a table whose header is its first filled row. */
export interface WorkbookText {
    /** One stretch per sheet: its name as a heading, a blank line, then its rows (the chunker cuts them by row with the header). */
    readonly pages: ReadonlyArray<DocumentPage>
    /** The tables, one per sheet that holds anything. */
    readonly tables: ReadonlyArray<DocumentTable>
    /** How many sheets the workbook has. */
    readonly sheetCount: number
    /** Empty sheets and sheets cut at the row limit. */
    readonly warnings: ReadonlyArray<DocumentWarning>
}

/** The sheets of an XLSX workbook as tables. Rejects when the archive is no workbook. */
export const workbookText = (bytes: Uint8Array): WorkbookText => {
    const parts = officeParts(
        bytes,
        (name) =>
            name === "xl/workbook.xml" ||
            name === "xl/_rels/workbook.xml.rels" ||
            name === "xl/sharedStrings.xml" ||
            name === "xl/styles.xml" ||
            name.startsWith("xl/worksheets/"),
    )
    if (!parts.has("xl/workbook.xml")) throw new Error("not a workbook")
    const book: CellBook = {
        strings: sharedStringsOf(parts.get("xl/sharedStrings.xml")),
        dates: dateStylesOf(parts.get("xl/styles.xml")),
    }
    const pages: Array<DocumentPage> = []
    const tables: Array<DocumentTable> = []
    const warnings: Array<DocumentWarning> = []
    const sheets = sheetsOf(parts)
    for (const sheet of sheets) {
        const made = tableOf(sheet.name, sheetRows(parts.get(sheet.path) ?? "", book))
        warnings.push(...made.warnings)
        if (made.table === null) {
            warnings.push({ code: DocumentWarningCode.PlaceEmpty, place: sheet.name, count: null })
            continue
        }
        tables.push(made.table)
        pages.push({
            kind: "sheet",
            label: sheet.name,
            text: `## ${sheet.name}\n\n${tableText(made.table)}`,
            transcribed: false,
        })
    }
    return { pages, tables, sheetCount: sheets.length, warnings }
}

/** The number of a slide part (`ppt/slides/slide12.xml` is 12). */
const slideNumber = (name: string): number => Number(/slide(\d+)\.xml$/u.exec(name)?.[1] ?? "0")

/** The slides of a PPTX presentation, each its paragraphs one per line. Rejects when the archive is no presentation. */
export const presentationText = (
    bytes: Uint8Array,
): { pages: Array<DocumentPage>; warnings: Array<DocumentWarning> } => {
    const parts = officeParts(
        bytes,
        (name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name) || name === "ppt/presentation.xml",
    )
    if (!parts.has("ppt/presentation.xml")) throw new Error("not a presentation")
    const names = [...parts.keys()].filter((name) => name !== "ppt/presentation.xml")
    const ordered = names.sort((left, right) => slideNumber(left) - slideNumber(right))
    const pages: Array<DocumentPage> = []
    const warnings: Array<DocumentWarning> = []
    ordered.forEach((name, index) => {
        const label = String(index + 1)
        const text = [...(parts.get(name) ?? "").matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gu)]
            .map((paragraph) => runsOf(paragraph[1] ?? "", "a:t").trim())
            .filter((line) => line !== "")
            .join("\n")
        if (text === "") warnings.push({ code: DocumentWarningCode.PlaceEmpty, place: label, count: null })
        pages.push({ kind: "slide", label, text, transcribed: false })
    })
    return { pages, warnings }
}
