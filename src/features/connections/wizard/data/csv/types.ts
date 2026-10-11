/** Shapes shared by the csv_import server code and its wizard. Plain data only: safe to import from the browser. */

export type CsvEntity = "customer" | "order" | "product" | "transaction" | "other" | "document"
export const TABLE_ENTITIES: ReadonlyArray<Exclude<CsvEntity, "document">> = ["customer", "order", "product", "transaction", "other"]

/** Where the rows come from: an uploaded .csv/.xlsx, a Google Sheets link, rows typed or pasted, or documents. */
export type CsvSource = "file" | "sheet" | "manual" | "document"

/** How a column is read: `phone` keeps digits as text, `number` adds a parsed `<col>__number`, `date` adds `<col>__date`. */
export type ColumnKind = "text" | "phone" | "email" | "number" | "date"

/** Marks "no column": the row number is the id, or there is no title or date column. */
export const NO_COLUMN = "__none__"

/** The saved, non-secret setup of one import (stored as one JSON string in public_meta.config). */
export type CsvConfig = {
  readonly v: 1
  readonly source: CsvSource
  readonly entity: CsvEntity
  /** Header names; null = not mapped (row number for the id). */
  readonly idColumn: string | null
  readonly titleColumn: string | null
  readonly dateColumn: string | null
  readonly kinds: Readonly<Record<string, ColumnKind>>
  /** Headers seen when the mapping was made (the manual grid starts from them). */
  readonly columns: ReadonlyArray<string>
  /** The workbook sheet that was read. */
  readonly sheet?: string
  /** Google Sheets link (not secret); with a schedule the connector re-reads it. */
  readonly link?: string
}

export type CsvMapping = Pick<CsvConfig, "idColumn" | "titleColumn" | "dateColumn" | "kinds" | "columns">

export type CsvPreview = {
  readonly headers: ReadonlyArray<string>
  /** First 10 rows. */
  readonly sample: ReadonlyArray<ReadonlyArray<string>>
  readonly total: number
  readonly sheets: ReadonlyArray<string>
  readonly sheet: string
  readonly delimiter: string
  readonly mapping: CsvMapping
  /** Mapped columns of the saved setup that this file no longer has (re-upload only). */
  readonly missing: ReadonlyArray<string>
}

export type CsvImportResult = {
  readonly connectionId: string
  readonly added: number
  readonly updated: number
  readonly skipped: number
  readonly total: number
  readonly summary: string
}

export type CsvSavedImport = {
  readonly name: string
  readonly config: CsvConfig
  readonly file: string
  readonly summary: string
  readonly agentIds: ReadonlyArray<string>
  readonly scheduleMinutes: number | null
}

export const SCHEDULES: ReadonlyArray<number | null> = [null, 60, 360, 1440]

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_ROWS = 20_000
export const MAX_COLUMNS = 200
export const MAX_DOC_TEXT = 200_000
