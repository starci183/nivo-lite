import { Injectable } from "@nestjs/common"
import Papa from "papaparse"
import readXlsxFile from "read-excel-file/universal"
import { InjectPublicHost } from "./data-sources.decorators"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import type { PublicHostClient } from "./public-host.client"
import { TABLE_COPY } from "./messages/table.messages"
import { docExportUrl, isNotPublicAnswer, sheetExportUrl } from "./table-google.policy"
import {
    assertFileSize,
    decodeText,
    documentKind,
    isZip,
    looksBinary,
    rejected,
    tableFileKind,
    tableFromGrid,
    tableFromRows,
    withoutBom,
} from "./table-rows.policy"
import { TABLE_MAX_BYTES } from "./table-shapes.contracts"
import type { GoogleDocumentText, Table, UploadedDocumentText } from "./table-shapes.contracts"

const GOOGLE_TIMEOUT_MS = 20_000

@Injectable()
/** The client that reads tables and documents from files, public Google links and pasted text. */
export class TableClient {
    constructor(@InjectPublicHost() private readonly publicHost: PublicHostClient) {}

    /** Delimited text (comma, semicolon, tab or pipe, detected) to a table. */
    readText(text: string): Table {
        const parsed = Papa.parse<Array<string>>(withoutBom(text), {
            delimitersToGuess: [",", ";", "\t", "|"],
            skipEmptyLines: "greedy",
        })
        const bad = parsed.errors.find((error) => error.type === "Quotes")
        if (bad !== undefined && parsed.data.length === 0) {
            throw rejected(TABLE_COPY.brokenQuotes)
        }
        return tableFromRows(parsed.data, { delimiter: parsed.meta.delimiter || ",", sheets: [], sheet: "" })
    }

    /** Rows typed in the grid to a table. */
    readGrid(headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>): Table {
        return tableFromGrid(headers, rows)
    }

    /** An uploaded .csv or .xlsx to a table (a workbook: the named tab, else the first). */
    async readFile(name: string, bytes: Uint8Array, sheet?: string): Promise<Table> {
        assertFileSize(bytes)
        const kind = tableFileKind(name)
        if (kind === null) throw rejected(TABLE_COPY.onlyTables)
        if (kind === "csv") {
            if (looksBinary(bytes)) throw rejected(TABLE_COPY.notCsvText)
            return this.readText(decodeText(bytes))
        }
        if (!isZip(bytes)) throw rejected(TABLE_COPY.badXlsx)
        const sheets = await readXlsxFile(new Blob([new Uint8Array(bytes)])).catch((cause: unknown) => {
            throw rejected(TABLE_COPY.unreadableExcel, cause)
        })
        const chosen = sheets.find((candidate) => candidate.sheet === sheet) ?? sheets[0]
        if (chosen === undefined) throw rejected(TABLE_COPY.noSheets)
        return tableFromRows(chosen.data, {
            delimiter: "",
            sheets: sheets.map((candidate) => candidate.sheet),
            sheet: chosen.sheet,
        })
    }

    /** The table of a public Google Sheets tab. */
    async readSheetLink(link: string): Promise<Table> {
        return this.readText(await this.fetchGoogle(sheetExportUrl(link)))
    }

    /** The text of a public Google Doc. */
    async readDocumentLink(link: string): Promise<GoogleDocumentText> {
        const { url, id } = docExportUrl(link)
        return { id, text: await this.fetchGoogle(url) }
    }

    /** The text of an uploaded .docx, .pdf, .txt or .md. */
    async readDocumentFile(name: string, bytes: Uint8Array): Promise<UploadedDocumentText> {
        const label = name.replace(/^.*[\\/]/u, "").slice(0, 80)
        assertFileSize(bytes)
        const kind = documentKind(name)
        if (kind === null) throw rejected(TABLE_COPY.onlyDocuments(label))
        if (kind === "text") {
            if (looksBinary(bytes)) throw rejected(TABLE_COPY.notTextFile(label))
            return { text: decodeText(bytes) }
        }
        if (kind === "docx") {
            if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw rejected(TABLE_COPY.badDocx(label))
            try {
                const mammoth = await import("mammoth")
                return { text: (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value }
            } catch (cause) {
                throw rejected(TABLE_COPY.unreadableWord(label), cause)
            }
        }
        if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
            throw rejected(TABLE_COPY.badPdf(label))
        }
        try {
            const { extractText, getDocumentProxy } = await import("unpdf")
            const pdf = await getDocumentProxy(new Uint8Array(bytes))
            const out = await extractText(pdf, { mergePages: true })
            return { text: out.text, pages: out.totalPages }
        } catch (cause) {
            throw rejected(TABLE_COPY.unreadablePdf(label), cause)
        }
    }

    private async fetchGoogle(url: string): Promise<string> {
        const answer = await this.publicHost
            .get(url, {
                timeoutMs: GOOGLE_TIMEOUT_MS,
                maxBytes: TABLE_MAX_BYTES,
                headers: { accept: "text/csv,text/plain;q=0.9" },
            })
            .catch((cause: unknown) => {
                if (cause instanceof DataSourcesError && cause.code === DataSourcesErrorCode.TooLarge) {
                    throw rejected(TABLE_COPY.googleTooLarge, cause)
                }
                throw new DataSourcesError({
                    code: DataSourcesErrorCode.Unavailable,
                    params: { detail: TABLE_COPY.googleUnreachable },
                    cause,
                })
            })
        if (isNotPublicAnswer(answer.status, answer.headers["content-type"] ?? "", answer.text)) {
            throw rejected(TABLE_COPY.googleNotPublic)
        }
        if (answer.status !== 200) throw rejected(TABLE_COPY.googleNoData)
        return answer.text
    }
}
