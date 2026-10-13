/** What an import is about; `document` is the documents import. */
export type CsvEntity = "customer" | "order" | "product" | "transaction" | "other" | "document"

/** The entities a table import may choose. */
export const CSV_TABLE_ENTITIES: ReadonlyArray<Exclude<CsvEntity, "document">> = [
    "customer",
    "order",
    "product",
    "transaction",
    "other",
]

/** Where the rows come from: an uploaded .csv/.xlsx, a Google Sheets link, rows typed or pasted, or documents. */
export type CsvSource = "file" | "sheet" | "manual" | "document"

/** How a column is read: `phone` keeps digits as text, `number` adds `<col>__number`, `date` adds `<col>__date`. */
export type CsvColumnKind = "text" | "phone" | "email" | "number" | "date"

/** The column kinds, for validation. */
export const CSV_COLUMN_KINDS: ReadonlyArray<CsvColumnKind> = ["text", "phone", "email", "number", "date"]

/** Marks "no column": the row number is the id, or there is no title or date column. */
export const CSV_NO_COLUMN = "__none__"

/** The schedules a Google Sheets link may take, in minutes (null is manual). */
export const CSV_SCHEDULES: ReadonlyArray<number | null> = [null, 60, 360, 1440]

/** The saved, non-secret setup of one import (stored as one JSON string in the connection's public facts, key `config`). */
export interface CsvConfig {
    /** The version of the shape. */
    readonly v: 1
    /** Where the rows come from. */
    readonly source: CsvSource
    /** What the rows are about. */
    readonly entity: CsvEntity
    /** The id column; null means the row number. */
    readonly idColumn: string | null
    /** The title column; null means none. */
    readonly titleColumn: string | null
    /** The date column; null means none. */
    readonly dateColumn: string | null
    /** How each column is read. */
    readonly kinds: Readonly<Record<string, CsvColumnKind>>
    /** The headers seen when the mapping was made. */
    readonly columns: ReadonlyArray<string>
    /** The workbook tab that was read. */
    readonly sheet?: string
    /** The Google link (not secret); with a schedule the sync re-reads it. */
    readonly link?: string
}

/** The mapping part of a config. */
export type CsvMapping = Pick<CsvConfig, "idColumn" | "titleColumn" | "dateColumn" | "kinds" | "columns">

/** What reading a source answers before importing. */
export interface CsvPreview {
    /** The column names. */
    readonly headers: ReadonlyArray<string>
    /** The first 10 rows. */
    readonly sample: ReadonlyArray<ReadonlyArray<string>>
    /** How many data rows there are. */
    readonly total: number
    /** The workbook tab names. */
    readonly sheets: ReadonlyArray<string>
    /** The tab that was read. */
    readonly sheet: string
    /** The detected delimiter. */
    readonly delimiter: string
    /** The suggested (or, for a re-upload, the saved) mapping. */
    readonly mapping: CsvMapping
    /** Mapped columns of the saved setup that this data no longer has. */
    readonly missing: ReadonlyArray<string>
}

/** What an import answers. */
export interface CsvImportResult {
    /** The connection the rows went into. */
    readonly connectionId: string
    /** How many rows are new. */
    readonly added: number
    /** How many existing rows were updated. */
    readonly updated: number
    /** How many rows had no usable id. */
    readonly skipped: number
    /** How many rows the connection holds now. */
    readonly total: number
    /** The one-line summary saved on the connection. */
    readonly summary: string
}

/** The saved setup of one import, to upload again into it. */
export interface CsvSavedImport {
    /** The name of the import. */
    readonly name: string
    /** The saved config. */
    readonly config: CsvConfig
    /** The file label of the last import. */
    readonly file: string
    /** The summary of the last import. */
    readonly summary: string
    /** The agents that hold a grant on it. */
    readonly agentIds: ReadonlyArray<string>
    /** The schedule in minutes; null is manual. */
    readonly scheduleMinutes: number | null
}

/** One uploaded file as the wizard sends it. */
export interface CsvUploadedFile {
    /** The file name. */
    readonly name: string
    /** The bytes as base64. */
    readonly contentBase64: string
}

/** An uploaded file after decoding. */
export interface CsvDecodedFile {
    /** The file name. */
    readonly name: string
    /** The decoded bytes. */
    readonly bytes: Uint8Array
}

/** The typed grid after cleaning. */
export interface CsvGridRows {
    /** The column names. */
    readonly headers: ReadonlyArray<string>
    /** The data rows. */
    readonly rows: ReadonlyArray<ReadonlyArray<string>>
}

/** The source of a table import, as the owner chose it (all fields are checked in the domain). */
export interface CsvSourceRequest {
    /** `file`, `sheet`, `paste` or `grid`. */
    readonly kind: string
    /** What the rows are about (ignored for a re-upload). */
    readonly entity?: string | null
    /** An existing import to upload into. */
    readonly connectionId?: string | null
    /** The uploaded file (kind file). */
    readonly file?: CsvUploadedFile | null
    /** The workbook tab (kind file). */
    readonly sheet?: string | null
    /** The Google Sheets link (kind sheet). */
    readonly link?: string | null
    /** The pasted text (kind paste). */
    readonly text?: string | null
    /** The typed grid, {headers, rows} (kind grid). */
    readonly grid?: unknown
}

/** What a table import takes. */
export interface CsvImportRequest extends CsvSourceRequest {
    /** The chosen mapping, checked against the real headers. */
    readonly mapping?: unknown
    /** The schedule in minutes for a Google Sheets link; null is manual. */
    readonly schedule?: number | null
    /** The name of a new import. */
    readonly name?: string | null
}

/** What a documents import takes. */
export interface DocumentImportRequest {
    /** An existing documents import to add to. */
    readonly connectionId?: string | null
    /** The name of a new import. */
    readonly name?: string | null
    /** The uploaded documents (at most 20). */
    readonly files?: ReadonlyArray<CsvUploadedFile> | null
    /** A Google Docs link. */
    readonly link?: string | null
}

/** The most documents one import takes. */
export const CSV_MAX_DOCUMENT_FILES = 20
