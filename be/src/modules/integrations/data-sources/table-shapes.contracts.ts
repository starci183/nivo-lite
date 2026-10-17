/** The largest file or download one import reads: ten megabytes. */
export const TABLE_MAX_BYTES = 10 * 1024 * 1024

/** The most data rows one table import takes. */
export const TABLE_MAX_ROWS = 20_000

/** The most columns one table import takes. */
export const TABLE_MAX_COLUMNS = 200

/** The most characters one cell keeps. */
export const TABLE_CELL_MAX = 5_000

/** The most characters one document keeps. */
export const DOCUMENT_MAX_TEXT = 200_000

/** A table read from a file, a link, pasted text or a typed grid: the first filled row is the headers. */
export interface Table {
    /** Unique, non-empty column names. */
    readonly headers: ReadonlyArray<string>
    /** The data rows, each as wide as the headers. */
    readonly rows: ReadonlyArray<ReadonlyArray<string>>
    /** The delimiter that was detected (text sources), else an empty string. */
    readonly delimiter: string
    /** The tab names of a workbook (empty for other sources). */
    readonly sheets: ReadonlyArray<string>
    /** The tab that was read (empty for other sources). */
    readonly sheet: string
}

/** The text of one uploaded document. */
export interface UploadedDocumentText {
    /** The raw text. */
    readonly text: string
    /** The page count, when the format has pages. */
    readonly pages?: number
}

/** The text of one Google Doc. */
export interface GoogleDocumentText {
    /** The document id from the link. */
    readonly id: string
    /** The plain text export. */
    readonly text: string
}

/** The id and the CSV or text export address of a public Google link. */
export interface GoogleExport {
    /** The Google file id from the link. */
    readonly id: string
    /** The export address. */
    readonly url: string
}

/** The parts of a public Google link that pick the file and the tab. */
export interface GoogleLinkParts {
    /** The Google file id. */
    readonly id: string
    /** The tab id (sheets), "0" when none. */
    readonly gid: string
}

/** How an uploaded document is read. */
export type DocumentKind = "docx" | "pdf" | "text"

/** How an uploaded table is read. */
export type TableFileKind = "csv" | "xlsx"

/** The document text readers supplied by the app's chosen document integration. */
export interface TableDocumentReaders {
    /** Reads the text of a Word file. */
    docx(bytes: Uint8Array): Promise<string>
    /** Reads PDF text and preserves its page count. */
    pdfDetails(bytes: Uint8Array): Promise<UploadedDocumentText>
}
