/** One file as the back end takes it: its name and its bytes as base64. */
export interface UploadedFile {
    readonly name: string
    readonly contentBase64: string
}

/** What an import is about; `document` is the documents import. */
export type CsvEntity = "customer" | "order" | "product" | "transaction" | "other" | "document"

/** The entities a table import may choose. */
export const TABLE_ENTITIES: ReadonlyArray<Exclude<CsvEntity, "document">> = [
    "customer",
    "order",
    "product",
    "transaction",
    "other",
]

/** Where the rows come from: an uploaded .csv/.xlsx, a Google Sheets link, rows typed or pasted, or documents. */
export type CsvSource = "file" | "sheet" | "manual" | "document"

/** The sources an import can read, in the order they are offered. */
export const CSV_SOURCES: ReadonlyArray<CsvSource> = ["file", "sheet", "manual", "document"]

/** The steps of the import wizard. */
export type CsvStep = "source" | "data" | "docs" | "map" | "import" | "agent"
/** The steps of a table import, in order. */
export const TABLE_STEPS: ReadonlyArray<CsvStep> = ["source", "data", "map", "import", "agent"]
/** The steps of a documents import, in order. */
export const DOC_STEPS: ReadonlyArray<CsvStep> = ["source", "docs", "import", "agent"]

/** The rows typed or pasted into the wizard: columns with stable ids, rows with stable ids and one cell per column. */
export interface Grid {
    readonly columns: ReadonlyArray<{ readonly id: string; readonly name: string }>
    readonly rows: ReadonlyArray<{ readonly id: string; readonly cells: ReadonlyArray<string> }>
}

/** The most rows the typed grid holds; a file is used beyond it. */
export const MAX_GRID_ROWS = 1000

/** A kind of table rows from a select value; customers when unknown. */
export const tableEntityOf = (value: string): Exclude<CsvEntity, "document"> =>
    TABLE_ENTITIES.find((entity) => entity === value) ?? "customer"

/** How a column is read: `phone` keeps digits as text, `number` adds a parsed number, `date` adds a parsed date. */
export type ColumnKind = "text" | "phone" | "email" | "number" | "date"

/** Marks "no column": the row number is the id, or there is no title or date column. */
export const NO_COLUMN = "__none__"

/** The schedules a Google Sheets link may take, in minutes (null is manual). */
export const SCHEDULES: ReadonlyArray<number | null> = [null, 60, 360, 1440]

/** The largest file the browser sends: ten megabytes (the same total applies to several documents). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** The column mapping of an import. */
export interface CsvMapping {
    readonly idColumn: string | null
    readonly titleColumn: string | null
    readonly dateColumn: string | null
    readonly kinds: Readonly<Record<string, ColumnKind>>
    readonly columns: ReadonlyArray<string>
}

/** The saved, non-secret setup of one import. */
export interface CsvConfig extends CsvMapping {
    readonly source: CsvSource
    readonly entity: CsvEntity
    readonly sheet?: string
    readonly link?: string
}

/** What reading a source answers before importing. */
export interface CsvPreview {
    readonly headers: ReadonlyArray<string>
    readonly sample: ReadonlyArray<ReadonlyArray<string>>
    readonly total: number
    readonly sheets: ReadonlyArray<string>
    readonly sheet: string
    readonly delimiter: string
    readonly mapping: CsvMapping
    readonly missing: ReadonlyArray<string>
}

/** What an import answers. */
export interface CsvImportResult {
    readonly connectionId: string
    readonly added: number
    readonly updated: number
    readonly skipped: number
    readonly total: number
    readonly summary: string
}

/** The saved setup of one import, to upload again into it. */
export interface CsvSavedImport {
    readonly name: string
    readonly config: CsvConfig
    readonly file: string
    readonly summary: string
    readonly agentIds: ReadonlyArray<string>
    readonly scheduleMinutes: number | null
}

const KINDS: ReadonlyArray<string> = ["text", "phone", "email", "number", "date"]
const ENTITIES: ReadonlyArray<string> = [...TABLE_ENTITIES, "document"]

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

const kindOf = (value: unknown): ColumnKind => {
    const found = KINDS.find((kind) => kind === value)
    return found === "phone" || found === "email" || found === "number" || found === "date" ? found : "text"
}

/** Narrows the `DataJson` mapping the back end answers; unknown shapes become an empty mapping. */
export const parseMapping = (value: unknown): CsvMapping => {
    const input = isRecord(value) ? value : {}
    const kinds: Record<string, ColumnKind> = {}
    if (isRecord(input.kinds)) for (const [header, kind] of Object.entries(input.kinds)) kinds[header] = kindOf(kind)
    return {
        idColumn: textOrNull(input.idColumn),
        titleColumn: textOrNull(input.titleColumn),
        dateColumn: textOrNull(input.dateColumn),
        kinds,
        columns: Array.isArray(input.columns)
            ? input.columns.filter((column): column is string => typeof column === "string")
            : [],
    }
}

const entityOf = (value: unknown): CsvEntity => {
    const found = TABLE_ENTITIES.find((entity) => entity === value)
    return found ?? (value === "document" ? "document" : "other")
}

/** Narrows the saved `DataJson` config; null when it is not a config. */
export const parseConfig = (value: unknown): CsvConfig | null => {
    if (!isRecord(value) || !ENTITIES.includes(String(value.entity))) return null
    const source = CSV_SOURCES.find((candidate) => candidate === value.source)
    if (source === undefined) return null
    const sheet = typeof value.sheet === "string" ? value.sheet : undefined
    const link = typeof value.link === "string" ? value.link : undefined
    return {
        ...parseMapping(value),
        source,
        entity: entityOf(value.entity),
        ...(sheet === undefined ? {} : { sheet }),
        ...(link === undefined ? {} : { link }),
    }
}

/** Reads a browser file as base64 (the bytes only, no data-URL prefix) for a GraphQL mutation. */
export const uploadedFileOf = (file: File): Promise<UploadedFile> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error ?? new Error("The file could not be read"))
        reader.onload = () => {
            const url = typeof reader.result === "string" ? reader.result : ""
            resolve({ name: file.name, contentBase64: url.slice(url.indexOf(",") + 1) })
        }
        reader.readAsDataURL(file)
    })
