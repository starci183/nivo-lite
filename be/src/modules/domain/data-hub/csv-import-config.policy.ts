import { CSV_COPY } from "./messages/csv-import.messages"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { CSV_COLUMN_KINDS, CSV_NO_COLUMN, CSV_SCHEDULES, CSV_TABLE_ENTITIES } from "./csv-import.contracts"
import type { CsvColumnKind, CsvConfig, CsvEntity, CsvMapping, CsvSource } from "./csv-import.contracts"

const SUMMARY_FORMAT = new Intl.NumberFormat("vi-VN")
const SOURCES: ReadonlySet<string> = new Set(["file", "sheet", "manual", "document"])
const ENTITIES: ReadonlySet<string> = new Set([...CSV_TABLE_ENTITIES, "document"])
const COLUMN_KINDS: ReadonlySet<string> = new Set(CSV_COLUMN_KINDS)
const SCHEDULES: ReadonlySet<number | null> = new Set(CSV_SCHEDULES)

/** The refusal of an import, with the plain-Vietnamese sentence the owner reads. */
export const invalid = (detail: string): DataHubError =>
    new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail } })

/** The label of each entity, read key by key. */
const ENTITY_LABELS: Readonly<Record<CsvEntity, string>> = {
    customer: CSV_COPY.entity.customer,
    order: CSV_COPY.entity.order,
    product: CSV_COPY.entity.product,
    transaction: CSV_COPY.entity.transaction,
    other: CSV_COPY.entity.other,
    document: CSV_COPY.entity.document,
}

/** The one-line summary of an import: the entity label, a middle dot, the count and its unit. */
export const summaryOf = (entity: CsvEntity, total: number): string =>
    `${ENTITY_LABELS[entity]} · ${SUMMARY_FORMAT.format(total)} ${entity === "document" ? CSV_COPY.documentUnit : CSV_COPY.rowUnit}`

/** True for a plain object. */
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const asText = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

const isSource = (value: unknown): value is CsvSource => typeof value === "string" && SOURCES.has(value)

const isEntity = (value: unknown): value is CsvEntity => typeof value === "string" && ENTITIES.has(value)

const isKind = (value: unknown): value is CsvColumnKind => typeof value === "string" && COLUMN_KINDS.has(value)

const kindsOf = (value: unknown): Record<string, CsvColumnKind> => {
    const kinds: Record<string, CsvColumnKind> = {}
    if (!isPlainObject(value)) return kinds
    for (const [header, kind] of Object.entries(value)) if (isKind(kind)) kinds[header] = kind
    return kinds
}

/** What parsing JSON text gave: the value, or null with the failure that stopped it. */
interface JsonOutcome {
    /** The parsed value; null when the text is not JSON. */
    readonly value: unknown
    /** The parse failure, when there was one. */
    readonly cause?: unknown
}

const parseJson = (text: string): JsonOutcome => {
    try {
        return { value: JSON.parse(text) }
    } catch (cause) {
        return { value: null, cause }
    }
}

/** The saved setup from a connection's public facts; null when it is missing or damaged. */
export const readConfig = (meta: Readonly<Record<string, string>> | null | undefined): CsvConfig | null => {
    const { value: parsed } = parseJson(meta?.config ?? "")
    if (!isPlainObject(parsed) || parsed.v !== 1 || !isSource(parsed.source) || !isEntity(parsed.entity)) return null
    const sheet = typeof parsed.sheet === "string" ? parsed.sheet : undefined
    const link = typeof parsed.link === "string" ? parsed.link : undefined
    return {
        v: 1,
        source: parsed.source,
        entity: parsed.entity,
        idColumn: asText(parsed.idColumn),
        titleColumn: asText(parsed.titleColumn),
        dateColumn: asText(parsed.dateColumn),
        kinds: kindsOf(parsed.kinds),
        columns: Array.isArray(parsed.columns)
            ? parsed.columns.filter((column): column is string => typeof column === "string")
            : [],
        ...(sheet === undefined ? {} : { sheet }),
        ...(link === undefined ? {} : { link }),
    }
}

/** True for a schedule a Google Sheets link may take. */
export const isSchedule = (value: unknown): value is number | null =>
    (typeof value === "number" || value === null) && SCHEDULES.has(value)

/** The mapping stored in a config. */
export const mappingOf = (config: CsvConfig): CsvMapping => ({
    idColumn: config.idColumn,
    titleColumn: config.titleColumn,
    dateColumn: config.dateColumn,
    kinds: config.kinds,
    columns: config.columns,
})

/** Which mapped columns (id, title, date) the new headers no longer carry. */
export const missingColumns = (
    config: Pick<CsvConfig, "idColumn" | "titleColumn" | "dateColumn">,
    headers: ReadonlyArray<string>,
): ReadonlyArray<string> =>
    [config.idColumn, config.titleColumn, config.dateColumn].filter(
        (column): column is string => column !== null && column !== "" && !headers.includes(column),
    )

/** The entity a new table import chose; a refusal when it is not one of the table entities. */
export const tableEntityOf = (raw: string | null | undefined): Exclude<CsvEntity, "document"> => {
    const entity = CSV_TABLE_ENTITIES.find((candidate) => candidate === raw)
    if (entity === undefined) throw invalid(CSV_COPY.chooseEntity)
    return entity
}

/** The name of a new import, trimmed to 60 characters, at least 2. */
export const cleanImportName = (raw: string | null | undefined): string => {
    const name = (raw ?? "").trim().replace(/\s+/gu, " ").slice(0, 60)
    if (name.length < 2) throw invalid(CSV_COPY.nameTooShort)
    return name
}

/** Checks a mapping that came from the browser: every name must be a real header, every kind a known one. */
export const cleanMapping = (raw: unknown, headers: ReadonlyArray<string>): CsvMapping => {
    const input = isPlainObject(raw) ? raw : {}
    const pick = (value: unknown): string | null => {
        if (value === null || value === undefined || value === CSV_NO_COLUMN || value === "") return null
        if (typeof value !== "string" || !headers.includes(value)) {
            throw invalid(CSV_COPY.columnMissing(typeof value === "string" ? value.slice(0, 60) : ""))
        }
        return value
    }
    const given = isPlainObject(input.kinds) ? input.kinds : {}
    const kinds: Record<string, CsvColumnKind> = {}
    for (const header of headers) {
        const kind = given[header]
        kinds[header] = isKind(kind) ? kind : "text"
    }
    return {
        idColumn: pick(input.idColumn),
        titleColumn: pick(input.titleColumn),
        dateColumn: pick(input.dateColumn),
        kinds,
        columns: [...headers],
    }
}
