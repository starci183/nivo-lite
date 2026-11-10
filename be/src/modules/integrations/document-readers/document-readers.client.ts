import { Injectable } from "@nestjs/common"
import { ok, refused } from "@modules/platform/primitives"
import { DOCUMENT_MAX_BYTES, DocumentRefusalCode } from "./document-readers.contracts"
import type {
    DocumentFile,
    DocumentLibraries,
    DocumentReadOutcome,
    DocumentReaderKind,
    ReadDocument,
    ReadOptions,
} from "./document-readers.contracts"
import { InjectDocumentLibraries } from "./document-readers.decorators"
import type { DocumentReadersPort } from "./document-readers.port"
import { acceptsName, kindOf } from "./document-kind.policy"
import { htmlText } from "./html-reader.mapper"
import { readSlides, readWord, readWorkbook } from "./office-reader.client"
import { readPdf } from "./pdf-reader.client"
import { readPicture } from "./picture-reader.client"
import { decodeText, delimitedRows, looksBinary, sectionsOf, tableOf, tableText } from "./text-reader.mapper"

/** Any letter of any script. */
const LETTER = /\p{L}|\p{N}/u

/** The delimiter of a CSV file: the one its first line holds most of, comma by default (a Vietnamese Excel may export with `;`). */
const csvDelimiterOf = (text: string): string => {
    const first = text.slice(0, text.indexOf("\n") < 0 ? text.length : text.indexOf("\n"))
    const counts = [",", ";", "\t"].map((delimiter) => ({ delimiter, count: first.split(delimiter).length - 1 }))
    const best = counts.sort((left, right) => right.count - left.count)[0]
    return best !== undefined && best.count > 0 ? best.delimiter : ","
}

/** A document read by code with no places: its text, and the sections when it has headings. */
const plainOf = (reader: DocumentReaderKind, text: string): ReadDocument => {
    const sections = reader === "markdown" ? sectionsOf(text) : []
    return {
        reader,
        text,
        ...(sections.length > 0 ? { sections } : {}),
        pageCount: null,
        sheetCount: null,
        transcribed: false,
        warnings: [],
    }
}

/** A text file of a kind read by code: plain, Markdown, delimited or HTML. */
const readText = (reader: DocumentReaderKind, bytes: Uint8Array): DocumentReadOutcome => {
    if (looksBinary(bytes)) return refused(DocumentRefusalCode.Unreadable)
    const text = decodeText(bytes)
    if (reader === "html") {
        const read = htmlText(text)
        return ok({
            ...plainOf(reader, read.text),
            ...(read.sections.length > 0 ? { sections: read.sections } : {}),
            ...(read.tables.length > 0 ? { tables: read.tables } : {}),
            warnings: read.warnings,
        })
    }
    if (reader !== "csv" && reader !== "tsv") return ok(plainOf(reader, text.trim()))
    const made = tableOf(null, delimitedRows(text, reader === "tsv" ? "\t" : csvDelimiterOf(text)))
    if (made.table === null) return ok(plainOf(reader, ""))
    return ok({ ...plainOf(reader, tableText(made.table)), tables: [made.table], warnings: made.warnings })
}

@Injectable()
/**
 * The document readers: the extension (else the first bytes, else the content type) picks one reader per kind, every reader gives
 * clean text with its places, sections and tables, and every way a file cannot be read is a refusal with its own code, never an
 * empty success. A document whose text holds no letter or digit is refused as no text.
 */
export class DocumentReadersClient implements DocumentReadersPort {
    constructor(@InjectDocumentLibraries() private readonly libraries: DocumentLibraries) {}

    /** True when a file name can be taken at the upload door. */
    acceptsName(name: string): boolean {
        return acceptsName(name)
    }

    /** The text of a file, or why it cannot be read. */
    async read(file: DocumentFile, options: ReadOptions): Promise<DocumentReadOutcome> {
        if (file.bytes.length > DOCUMENT_MAX_BYTES) return refused(DocumentRefusalCode.TooLarge)
        if (file.bytes.length === 0) return refused(DocumentRefusalCode.NoText)
        const verdict = kindOf(file.name, file.mime, file.bytes)
        if (verdict.kind === "refused") return refused(verdict.code)
        const read = await this.byKind(verdict.reader, file.bytes, options)
        if (read.kind === "ok" && !LETTER.test(read.value.text)) return refused(DocumentRefusalCode.NoText)
        return read
    }

    /** The reader of one kind. */
    private byKind(reader: DocumentReaderKind, bytes: Uint8Array, options: ReadOptions): Promise<DocumentReadOutcome> {
        if (reader === "pdf") return readPdf(bytes, this.libraries, options.transcriber)
        if (reader === "docx") return readWord(bytes, this.libraries)
        if (reader === "xlsx") return Promise.resolve(readWorkbook(bytes))
        if (reader === "pptx") return Promise.resolve(readSlides(bytes))
        if (reader === "image" || reader === "heic") {
            return readPicture(reader, bytes, this.libraries, options.transcriber)
        }
        return Promise.resolve(readText(reader, bytes))
    }
}
