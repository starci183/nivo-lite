import { DATABASE_MAX_ROWS } from "./database-session.contracts"
import type {
    DatabaseEngine,
    DatabaseSelection,
    DatabaseSession,
    DatabaseStatement,
    DatabaseTable,
} from "./database-session.contracts"
import { DATABASE_CURSOR } from "./database-values.policy"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { DATABASE_COPY } from "./messages/database.messages"

const MAX_TABLES = 500
const MAX_LISTED_COLUMNS = 20_000
const MAX_COLUMNS_PER_TABLE = 300
const MAX_IDENTIFIER = 200

/** True when a table or column name can be quoted safely. */
export const isUsableIdentifier = (id: string): boolean =>
    id.length > 0 && id.length <= MAX_IDENTIFIER && !id.includes("\u0000")

/** Quotes a table or column name for the engine; the name must pass isUsableIdentifier. */
export const quoteId = (engine: DatabaseEngine, id: string): string => {
    if (engine === "mysql") return `\`${id.replaceAll("`", "``")}\``
    if (engine === "mssql") return `[${id.replaceAll("]", "]]")}]`
    return `"${id.replaceAll('"', '""')}"`
}

const castText = (engine: DatabaseEngine, column: string): string => {
    if (engine === "mysql") return `CAST(${column} AS CHAR)`
    if (engine === "mssql") return `CONVERT(nvarchar(40), ${column}, 126)`
    return `(${column})::text`
}

/** The columns a read needs: id, title, updated-at and the brought ones, once each. */
export const wantedColumns = (selection: DatabaseSelection): ReadonlyArray<string> => [
    ...new Set([
        selection.idColumn,
        ...(selection.titleColumn === "" ? [] : [selection.titleColumn]),
        ...(selection.updatedColumn === "" ? [] : [selection.updatedColumn]),
        ...selection.columns,
    ]),
]

/** A read options pair for buildSelect. */
export interface SelectOptions {
    /** The most rows. */
    readonly limit: number
    /** Only rows updated at or after this value. */
    readonly cursor?: string | null
    /** False to skip ORDER BY (the preview). */
    readonly ordered?: boolean
}

/** SELECT of the mapped columns, generated from quoted identifiers; the owner's SQL is never run. */
export const buildSelect = (
    engine: DatabaseEngine,
    selection: DatabaseSelection,
    options: SelectOptions,
): DatabaseStatement => {
    const names = [selection.schema, selection.table, ...wantedColumns(selection)]
    if (!names.every(isUsableIdentifier))
        throw new DataSourcesError({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: DATABASE_COPY.badName },
        })
    const q = (column: string): string => quoteId(engine, column)
    const columns = wantedColumns(selection).map(q)
    const hasUpdated = selection.updatedColumn !== ""
    if (hasUpdated) columns.push(`${castText(engine, q(selection.updatedColumn))} AS ${q(DATABASE_CURSOR)}`)
    const cursor = options.cursor ?? null
    const incremental = hasUpdated && cursor !== null && cursor !== ""
    let marker = "@p0"
    if (engine === "postgres") marker = "$1"
    else if (engine === "mysql") marker = "?"
    const where = incremental ? ` WHERE ${q(selection.updatedColumn)} >= ${marker}` : ""
    const orderColumn = hasUpdated ? selection.updatedColumn : selection.idColumn
    const order = options.ordered === false ? "" : ` ORDER BY ${q(orderColumn)} ASC`
    const n = Math.max(1, Math.min(Math.floor(options.limit), DATABASE_MAX_ROWS))
    const from = ` FROM ${q(selection.schema)}.${q(selection.table)}${where}${order}`
    const sql =
        engine === "mssql"
            ? `SELECT TOP (${n}) ${columns.join(", ")}${from}`
            : `SELECT ${columns.join(", ")}${from} LIMIT ${n}`
    return { sql, params: incremental ? [cursor] : [] }
}

const LIST_POSTGRES = `SELECT c.table_schema AS s, c.table_name AS t, c.column_name AS c, c.data_type AS d FROM information_schema.columns c JOIN information_schema.tables x ON x.table_schema = c.table_schema AND x.table_name = c.table_name WHERE x.table_type IN ('BASE TABLE','VIEW') AND c.table_schema NOT IN ('pg_catalog','information_schema') ORDER BY c.table_schema, c.table_name, c.ordinal_position LIMIT ${MAX_LISTED_COLUMNS}`
const LIST_MYSQL = `SELECT c.TABLE_SCHEMA AS s, c.TABLE_NAME AS t, c.COLUMN_NAME AS c, c.DATA_TYPE AS d FROM information_schema.COLUMNS c JOIN information_schema.TABLES x ON x.TABLE_SCHEMA = c.TABLE_SCHEMA AND x.TABLE_NAME = c.TABLE_NAME WHERE x.TABLE_TYPE IN ('BASE TABLE','VIEW') AND c.TABLE_SCHEMA = DATABASE() ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION LIMIT ${MAX_LISTED_COLUMNS}`
const LIST_MSSQL = `SELECT TOP (${MAX_LISTED_COLUMNS}) c.TABLE_SCHEMA AS s, c.TABLE_NAME AS t, c.COLUMN_NAME AS c, c.DATA_TYPE AS d FROM INFORMATION_SCHEMA.COLUMNS c JOIN INFORMATION_SCHEMA.TABLES x ON x.TABLE_SCHEMA = c.TABLE_SCHEMA AND x.TABLE_NAME = c.TABLE_NAME WHERE x.TABLE_TYPE IN ('BASE TABLE','VIEW') AND c.TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA','sys') ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`

const pick = (row: Readonly<Record<string, unknown>>, lower: string): string => {
    const value = row[lower] ?? row[lower.toUpperCase()]
    return typeof value === "string" ? value : ""
}

/** Tables and views the user can see, with their columns. */
export const listTables = async (session: DatabaseSession): Promise<ReadonlyArray<DatabaseTable>> => {
    let sql = LIST_POSTGRES
    if (session.engine === "mysql") sql = LIST_MYSQL
    else if (session.engine === "mssql") sql = LIST_MSSQL
    const rows = await session.query(sql)
    const tables = new Map<string, { schema: string; name: string; columns: Array<{ name: string; type: string }> }>()
    for (const row of rows) {
        const schema = pick(row, "s")
        const name = pick(row, "t")
        const key = `${schema}\u0000${name}`
        let table = tables.get(key)
        if (table === undefined) {
            if (tables.size >= MAX_TABLES) continue
            table = { schema, name, columns: [] }
            tables.set(key, table)
        }
        if (table.columns.length < MAX_COLUMNS_PER_TABLE)
            table.columns.push({ name: pick(row, "c"), type: pick(row, "d") })
    }
    return [...tables.values()]
}
