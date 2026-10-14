import { DOCUMENT_MAX_TEXT } from "@modules/integrations/data-sources"
import type { Table, UploadedDocumentText } from "@modules/integrations/data-sources"
import type { DataRecordInput } from "./data-hub.contracts"
import type { CsvMapping } from "./csv-import.contracts"
import { CSV_COPY } from "./messages/csv-import.messages"
import { invalid } from "./csv-import-config.policy"
import { normalisePhone, parseDateLoose, parseNumberLoose } from "./csv-import-values.policy"

/** A document text cut to the limit. */
interface ClippedText {
    /** The text, at most the limit long. */
    readonly text: string
    /** True when the text was cut. */
    readonly truncated: boolean
}

/** The rows built from a table. */
export interface CsvBuiltRecords {
    /** The hub rows, one per id. */
    readonly records: ReadonlyArray<DataRecordInput>
    /** Rows skipped because their id was empty or too long. */
    readonly skipped: number
    /** Rows that repeated an earlier id (the last one wins). */
    readonly duplicates: number
}

/** Rows to hub records: trimmed text, phones as digit text, parsed numbers and dates in separate fields, the original text kept. */
export const buildRecords = (table: Pick<Table, "headers" | "rows">, mapping: CsvMapping): CsvBuiltRecords => {
    const { headers, rows } = table
    const column = (name: string | null): number => (name === null ? -1 : headers.indexOf(name))
    const idIndex = column(mapping.idColumn)
    const titleIndex = column(mapping.titleColumn)
    const dateIndex = column(mapping.dateColumn)
    const byId = new Map<string, DataRecordInput>()
    let skipped = 0
    let duplicates = 0
    rows.forEach((row, n) => {
        const data: Record<string, unknown> = {}
        headers.forEach((header, index) => {
            const raw = (row[index] ?? "").trim()
            if (raw === "") return
            const kind = mapping.kinds[header] ?? "text"
            if (kind === "phone") {
                const phone = normalisePhone(raw)
                data[header] = phone || raw
                if (phone !== "" && phone !== raw) data[`${header}__raw`] = raw
            } else if (kind === "email") data[header] = raw.toLowerCase()
            else {
                data[header] = raw
                if (kind === "number") {
                    const value = parseNumberLoose(raw)
                    if (value !== null) data[`${header}__number`] = value
                }
                if (kind === "date") {
                    const value = parseDateLoose(raw)
                    if (value !== null) data[`${header}__date`] = value
                }
            }
        })
        if (Object.keys(data).length === 0) return
        const lineNo = n + 1
        let externalId: string
        if (idIndex >= 0) {
            const value = (row[idIndex] ?? "").trim()
            if (value === "" || value.length > 300) {
                skipped += 1
                return
            }
            externalId =
                mapping.idColumn !== null && mapping.kinds[mapping.idColumn] === "phone"
                    ? normalisePhone(value) || value
                    : value
        } else externalId = `row-${lineNo}`
        const titled = titleIndex >= 0 ? (row[titleIndex] ?? "").trim() : ""
        const title = titled || (idIndex >= 0 ? externalId : CSV_COPY.rowTitle(lineNo))
        const when = dateIndex >= 0 ? parseDateLoose((row[dateIndex] ?? "").trim()) : null
        if (byId.has(externalId)) duplicates += 1
        byId.set(externalId, { externalId, title: title.slice(0, 300), occurredAt: when, data })
    })
    return { records: [...byId.values()], skipped, duplicates }
}

const clip = (text: string): ClippedText => {
    const clean = text
        .replace(/\r\n?/gu, "\n")
        .replace(/\u0000/gu, "")
        .trim()
    return clean.length > DOCUMENT_MAX_TEXT
        ? { text: clean.slice(0, DOCUMENT_MAX_TEXT), truncated: true }
        : { text: clean, truncated: false }
}

/** The first heading ("# Title") or the first non-empty line, else the fallback. */
const titleFrom = (text: string, fallback: string): string => {
    const heading = /^\s{0,3}#{1,6}\s+(.+)$/mu.exec(text)?.[1]
    const line = heading ?? text.split("\n").find((candidate) => candidate.trim() !== "")
    return (
        (line ?? fallback)
            .trim()
            .replace(/^#+\s*/u, "")
            .slice(0, 120) || fallback
    )
}

/** One uploaded document to one hub row; the external id is the file name, so the same name replaces it. */
export const recordFromDocument = (name: string, extracted: UploadedDocumentText): DataRecordInput => {
    const label = name.replace(/^.*[\\/]/u, "").slice(0, 80)
    const { text, truncated } = clip(extracted.text)
    if (text === "") throw invalid(CSV_COPY.documentNoText(label))
    const base = name.replace(/^.*[\\/]/u, "").slice(0, 300)
    return {
        externalId: base,
        title: titleFrom(text, base),
        data: {
            text,
            source: "upload",
            fileName: base,
            ...(extracted.pages === undefined ? {} : { pages: extracted.pages }),
            ...(truncated ? { truncated: true } : {}),
        },
    }
}

/** A Google Docs text export to one hub row. */
export const recordFromGoogleDoc = (docId: string, raw: string): DataRecordInput => {
    const { text, truncated } = clip(raw.codePointAt(0) === 0xfeff ? raw.slice(1) : raw)
    if (text === "") throw invalid(CSV_COPY.googleDocEmpty)
    return {
        externalId: docId,
        title: titleFrom(text, CSV_COPY.googleDocTitle(docId.slice(0, 8))),
        data: { text, source: "google_docs", docId, ...(truncated ? { truncated: true } : {}) },
    }
}
