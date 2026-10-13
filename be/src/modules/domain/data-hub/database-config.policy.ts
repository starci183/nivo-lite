import { DATABASE_ENGINES, DATABASE_MAX_COLUMNS, isUsableIdentifier } from "@modules/integrations/data-sources"
import type { DatabaseEngine, DatabaseSelection, DatabaseTarget } from "@modules/integrations/data-sources"
import { DATABASE_ENTITIES, DATABASE_MAX_TABLES } from "./database-config.contracts"
import type { DatabaseConfig, DatabaseEntity, JsonOutcome, TableMapping } from "./database-config.contracts"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { DATABASE_WIZARD_COPY as COPY } from "./messages/database.messages"

const DEFAULT_PORT: Readonly<Record<DatabaseEngine, number>> = { postgres: 5432, mysql: 3306, mssql: 1433 }
const ENGINE_LABEL: Readonly<Record<DatabaseEngine, string>> = {
    postgres: "PostgreSQL",
    mysql: "MySQL",
    mssql: "SQL Server",
}

/** A plain refusal the owner reads as is. */
export const invalid = (detail: string, cause?: unknown): DataHubError =>
    new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail }, cause })

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const isEngine = (value: unknown): value is DatabaseEngine => DATABASE_ENGINES.some((engine) => engine === value)

const isEntity = (value: unknown): value is DatabaseEntity => DATABASE_ENTITIES.some((entity) => entity === value)

const text = (value: unknown): string => (typeof value === "string" ? value : "")

const ident = (value: unknown): string => (typeof value === "string" && isUsableIdentifier(value) ? value : "")

/** Reads JSON text; a failure comes back as an outcome that carries it. */
export const readJson = (raw: string): JsonOutcome => {
    try {
        const value: unknown = JSON.parse(raw)
        return { ok: true, value }
    } catch (cause) {
        return { ok: false, cause }
    }
}

/** The key of a table in cursors and messages. */
export const tableKey = (table: Pick<DatabaseSelection, "schema" | "table">): string =>
    `${table.schema}.${table.table}`

/** The stored credential JSON as a target; a broken or incomplete one is a plain refusal. */
export const parseTarget = (raw: string): DatabaseTarget => {
    const read = readJson(raw)
    if (!read.ok) throw invalid(COPY.brokenCredential, read.cause)
    const parsed = read.value
    if (!isObject(parsed)) throw invalid(COPY.brokenCredential)
    const { engine, host, database, user } = parsed
    if (!isEngine(engine) || text(host) === "" || text(database) === "" || text(user) === "") {
        throw invalid(COPY.incompleteCredential)
    }
    return {
        engine,
        host: text(host),
        port: Number(parsed.port) || DEFAULT_PORT[engine],
        database: text(database),
        user: text(user),
        password: text(parsed.password),
        ssl: parsed.ssl !== false,
    }
}

/** What the owner typed, trimmed and typed right. */
export const cleanTarget = (typed: DatabaseTarget): DatabaseTarget => ({
    engine: typed.engine,
    host: typed.host.trim(),
    port: Number(typed.port),
    database: typed.database.trim(),
    user: typed.user.trim(),
    password: typed.password,
    ssl: Boolean(typed.ssl),
})

/** Checks what the owner typed (shape only; reaching the server is the connection test); null when fine. */
export const checkTarget = (target: DatabaseTarget): string | null => {
    if (!isEngine(target.engine)) return COPY.badEngine
    if (target.host === "" || target.host.length > 253) return COPY.needHost
    if (!Number.isInteger(target.port) || target.port < 1 || target.port > 65_535) return COPY.badPort
    if (target.database === "" || target.database.length > 128) return COPY.needDatabase
    if (target.user === "" || target.user.length > 128) return COPY.needUser
    if (target.password.length > 512) return COPY.passwordTooLong
    return null
}

/** The credential JSON as the old code stored it. */
export const credentialOf = (target: DatabaseTarget): string =>
    JSON.stringify({
        engine: target.engine,
        host: target.host,
        port: target.port,
        database: target.database,
        user: target.user,
        password: target.password,
        ssl: target.ssl,
    })

/** Cleaned tables, or the sentence that says what is wrong. */
type TablesOutcome = { readonly tables: ReadonlyArray<TableMapping> } | { readonly problem: string }

const cleanTable = (raw: unknown): TableMapping | string => {
    const source = isObject(raw) ? raw : {}
    const table = ident(source.table)
    const idColumn = ident(source.idColumn)
    if (table === "" || idColumn === "") return COPY.needIdColumn(table === "" ? COPY.unnamedTable : table)
    const columns = Array.isArray(source.columns) ? source.columns.map(ident).filter((column) => column !== "") : []
    return {
        schema: ident(source.schema),
        table,
        entity: isEntity(source.entity) ? source.entity : "other",
        idColumn,
        titleColumn: ident(source.titleColumn),
        updatedColumn: ident(source.updatedColumn),
        columns: [...new Set(columns)].slice(0, DATABASE_MAX_COLUMNS),
    }
}

const tablesOutcome = (raw: unknown): TablesOutcome => {
    if (!Array.isArray(raw) || raw.length === 0) return { problem: COPY.needTable }
    if (raw.length > DATABASE_MAX_TABLES) return { problem: COPY.tooManyTables }
    const seen = new Set<string>()
    const tables: Array<TableMapping> = []
    for (const entry of raw) {
        const cleaned = cleanTable(entry)
        if (typeof cleaned === "string") return { problem: cleaned }
        const key = tableKey(cleaned)
        if (seen.has(key)) return { problem: COPY.pickedTwice(key) }
        seen.add(key)
        tables.push(cleaned)
    }
    return { tables }
}

/** Validates a list of mapped tables that came from the browser; returns a clean copy or a plain refusal. */
export const cleanTables = (raw: unknown): DatabaseConfig => {
    const outcome = tablesOutcome(raw)
    if ("problem" in outcome) throw invalid(outcome.problem)
    return { tables: outcome.tables }
}

/** The mapped tables of the saved config JSON string; empty when it is missing or broken. */
export const savedTables = (json: string | undefined): ReadonlyArray<TableMapping> => {
    const read = readJson(json ?? "{}")
    const outcome = read.ok && isObject(read.value) ? tablesOutcome(read.value.tables) : { problem: COPY.needTable }
    return "tables" in outcome ? outcome.tables : []
}

/** The mapped tables of the saved config JSON string; a missing or broken one is a plain refusal. */
export const parseConfig = (json: string | undefined): DatabaseConfig => {
    const tables = savedTables(json)
    if (tables.length === 0) throw invalid(COPY.brokenConfig)
    return { tables }
}

/** The one line shown on the connection card. */
export const summaryOf = (engine: DatabaseEngine, tables: number): string =>
    COPY.summary(ENGINE_LABEL[engine], tables)
