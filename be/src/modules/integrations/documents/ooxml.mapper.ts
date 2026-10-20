import { strFromU8, unzipSync } from "fflate"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"

/** The most rows of one sheet that reach the text of a workbook. */
export const XLSX_MAX_ROWS = 2000

/** The largest part of an Office archive that is inflated. */
const MAX_PART_BYTES = 60_000_000

/** The letters of a spreadsheet column, in order. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

/** The text of a boolean cell value. */
const BOOLEAN_TEXT: ReadonlyMap<string, string> = new Map([
    ["1", "TRUE"],
    ["0", "FALSE"],
])

/** One group of a match, or an empty text when the group did not take part. */
export const captured = (match: RegExpExecArray | RegExpMatchArray, group: number): string => match[group] ?? ""

const fromCode = (code: number): string => (code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "")

/** The XML entities of a text decoded: numeric ones first, `&amp;` last so a decoded ampersand is never decoded twice. */
const decodeEntities = (text: string): string =>
    text
        .replace(/&#x([0-9a-f]+);/giu, (_match, hex: string) => fromCode(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/gu, (_match, decimal: string) => fromCode(Number.parseInt(decimal, 10)))
        .replace(/&lt;/giu, "<")
        .replace(/&gt;/giu, ">")
        .replace(/&quot;/giu, '"')
        .replace(/&apos;/giu, "'")
        .replace(/&amp;/giu, "&")

/** The decoded value of one attribute of a tag, or null when the tag does not carry it. */
const attributeOf = (tag: string, name: string): string | null => {
    const match = new RegExp(String.raw`(?:^|[\s:])${name}="([^"]*)"`, "u").exec(tag)
    return match === null ? null : decodeEntities(captured(match, 1))
}

/** Opens the archive and inflates only the parts `wanted` accepts (and no part over 60 MB). */
const partsOf = (bytes: Uint8Array, wanted: (name: string) => boolean): Record<string, string> => {
    const files = unzipSync(bytes, { filter: (file) => wanted(file.name) && file.originalSize <= MAX_PART_BYTES })
    return Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strFromU8(content)]))
}

/** The text of every `<tag>` run of an XML fragment, joined. */
const textRuns = (xml: string, tag: string): string =>
    [...xml.matchAll(new RegExp(String.raw`<${tag}(?:\s[^>]*)?>([\s\S]*?)</${tag}>`, "gu"))]
        .map((match) => decodeEntities(captured(match, 1)))
        .join("")

/** The zero-based column of a cell reference such as `C7`. */
const columnOf = (reference: string): number => {
    const lineBreak = Math.max(...["\n", "\r", "\u2028", "\u2029"].map((ending) => reference.lastIndexOf(ending)))
    const letters = lineBreak < 0 ? reference.replace(/[^A-Za-z][\s\S]*/u, "") : reference.slice(0, lineBreak)
    return Math.max(
        0,
        [...letters].reduce((column, letter) => column * 26 + ALPHABET.indexOf(letter.toUpperCase()) + 1, 0) - 1,
    )
}

/** The relationship ids of a `.rels` part with the target each one names. */
const relationshipTargets = (xml: string): Map<string, string> => {
    const targets = new Map<string, string>()
    for (const match of xml.matchAll(/<Relationship\b[^>]*>/gu)) {
        const id = attributeOf(match[0], "Id")
        const target = attributeOf(match[0], "Target")
        if (id !== null && target !== null) targets.set(id, target)
    }
    return targets
}

/** The shared strings of a workbook, phonetic runs left out. */
const sharedStringsOf = (xml: string): Array<string> =>
    [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gu)].map((match) =>
        textRuns(captured(match, 1).replace(/<rPh\b[\s\S]*?<\/rPh>/gu, ""), "t"),
    )

/** The text of one cell: a shared string, an inline string, a boolean or the stored value. */
const cellText = (type: string | null, body: string, shared: ReadonlyArray<string>): string => {
    const stored = /<v>([\s\S]*?)<\/v>/u.exec(body)
    const value = stored === null ? null : captured(stored, 1)
    if (type === "s") return value === null ? "" : (shared[Number(value)] ?? "")
    if (type === "inlineStr") return textRuns(body, "t")
    if (type === "b") return BOOLEAN_TEXT.get(String(value)) ?? ""
    return value === null ? "" : decodeEntities(value)
}

/** The cells of one row, empty cells kept up to the last filled one. */
const rowCells = (row: string, shared: ReadonlyArray<string>): Array<string> => {
    const cells: Array<string> = []
    let next = 0
    for (const cell of row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu)) {
        const attributes = captured(cell, 1)
        const reference = attributeOf(attributes, "r")
        const at = reference === null ? next : columnOf(reference)
        next = at + 1
        while (cells.length < at) cells.push("")
        cells[at] = cellText(attributeOf(attributes, "t"), captured(cell, 2), shared).replace(/\s+/gu, " ").trim()
    }
    while (cells.length > 0 && cells.at(-1) === "") cells.pop()
    return cells
}

/** The non-empty rows of one worksheet as `a | b | c` lines, at most XLSX_MAX_ROWS of them. */
const sheetLines = (xml: string, shared: ReadonlyArray<string>): Array<string> => {
    const lines: Array<string> = []
    for (const row of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/gu)) {
        if (lines.length >= XLSX_MAX_ROWS) break
        const cells = rowCells(captured(row, 1), shared)
        if (cells.length > 0) lines.push(cells.join(" | "))
    }
    return lines
}

/** The part name of a worksheet from the target its relationship names (absolute, or relative to `xl/`). */
const sheetPartOf = (target: string | undefined, position: number): string => {
    if (target === undefined) return `xl/worksheets/sheet${position}.xml`
    return target.startsWith("/") ? target.slice(1) : `xl/${target}`
}

/** Each sheet as a text table (cells joined by " | "), empty rows skipped, at most XLSX_MAX_ROWS rows per sheet. */
export const xlsxToText = (bytes: Uint8Array): string => {
    const parts = partsOf(
        bytes,
        (name) =>
            name === "xl/workbook.xml" ||
            name === "xl/_rels/workbook.xml.rels" ||
            name === "xl/sharedStrings.xml" ||
            /^xl\/worksheets\/[^/]+\.xml$/u.test(name),
    )
    const book = parts["xl/workbook.xml"]
    if (book === undefined) throw new DocumentsError({ code: DocumentsErrorCode.FileInvalid, params: { kind: "xlsx" } })
    const targets = relationshipTargets(parts["xl/_rels/workbook.xml.rels"] ?? "")
    const shared = sharedStringsOf(parts["xl/sharedStrings.xml"] ?? "")
    const blocks: Array<string> = []
    for (const [index, sheet] of [...book.matchAll(/<sheet\b[^>]*>/gu)].entries()) {
        const position = index + 1
        const name = attributeOf(sheet[0], "name") ?? `Sheet ${position}`
        const relationship = attributeOf(sheet[0], "id")
        const xml = parts[sheetPartOf(relationship === null ? undefined : targets.get(relationship), position)]
        const lines = xml === undefined ? [] : sheetLines(xml, shared)
        if (lines.length > 0) blocks.push(`## ${name}\n${lines.join("\n")}`)
    }
    return blocks.join("\n\n")
}

/** The paragraphs of a slide, one line each; the slide number field is left out. */
const paragraphs = (xml: string): string =>
    [...xml.replace(/<a:fld\b[^>]*type="slidenum"[\s\S]*?<\/a:fld>/gu, "").matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gu)]
        .map((match) => textRuns(captured(match, 1).replace(/<a:br\s*\/>/gu, "<a:t>\n</a:t>"), "a:t").trim())
        .filter((line) => line !== "")
        .join("\n")

/** The number in the file name of a slide part (`slide12.xml` is 12). */
const slideNumber = (part: string): number => Number(part.replace(/\D/gu, ""))

/** The speaker notes of a slide: the notes part its relationships name, as paragraphs. */
const notesOf = (parts: Readonly<Record<string, string>>, slidePart: string): string => {
    const relationships = parts[slidePart.replace("slides/", "slides/_rels/") + ".rels"] ?? ""
    const note = [...relationshipTargets(relationships).values()].find((target) => target.includes("notesSlides/"))
    return note === undefined ? "" : paragraphs(parts[`ppt/notesSlides/${note.split("/").pop()}`] ?? "")
}

/** Slides in order: "## Slide N" then the text of every shape; speaker notes follow as "Notes:". */
export const pptxToText = (bytes: Uint8Array): string => {
    const parts = partsOf(
        bytes,
        (name) =>
            /^ppt\/slides\/slide\d+\.xml$/u.test(name) ||
            /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/u.test(name) ||
            /^ppt\/notesSlides\/notesSlide\d+\.xml$/u.test(name),
    )
    const slides = Object.entries(parts)
        .filter(([part]) => /^ppt\/slides\/slide\d+\.xml$/u.test(part))
        .sort(([a], [b]) => slideNumber(a) - slideNumber(b))
    if (slides.length === 0)
        throw new DocumentsError({ code: DocumentsErrorCode.FileInvalid, params: { kind: "pptx" } })
    const blocks: Array<string> = []
    for (const [index, [part, xml]] of slides.entries()) {
        const body = paragraphs(xml)
        const notes = notesOf(parts, part)
        const lines = [`## Slide ${index + 1}`, body, notes === "" ? "" : `Notes:\n${notes}`].filter(
            (line) => line !== "",
        )
        if (lines.length > 1) blocks.push(lines.join("\n"))
    }
    return blocks.join("\n\n")
}
