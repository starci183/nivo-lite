import { z } from "zod"
import type {
    DbEngine,
    DbEntity,
    DbSavedConnection,
    DbTableInfo,
    DbTableMapping,
} from "@/modules/types"

/** A table named by its schema and either of the two spellings of its name. */
interface DbTableRef {
    readonly schema: string
    readonly name?: string
    readonly table?: string
}

/** The saved connection as the back end answers it (the wire shape the wizard reads). */
interface DbSavedWire {
    readonly name: string
    readonly target: {
        readonly engine: string
        readonly host: string
        readonly port: number
        readonly database: string
        readonly user: string
        readonly ssl: boolean
    }
    readonly hasPassword: boolean
    readonly tables: unknown
    readonly everyMinutes?: number | null
    readonly agentIds: ReadonlyArray<string>
}

/** The engines, in the order the select shows them. */
export const DB_ENGINES: ReadonlyArray<DbEngine> = ["postgres", "mysql", "mssql"]

/** The default port of each engine. */
export const DB_DEFAULT_PORT: Readonly<Record<DbEngine, number>> = { postgres: 5432, mysql: 3306, mssql: 1433 }

/** The entities a table can become. */
export const DB_ENTITIES: ReadonlyArray<DbEntity> = ["customer", "order", "product", "transaction", "other"]

/** The most columns brought per table. */
export const DB_MAX_COLUMNS = 30

/** The most rows read per table per sync. */
export const DB_MAX_ROWS = 5000

/** The sync periods the wizard offers; `minutes` null is manual only. */
export const DB_SCHEDULES: ReadonlyArray<{ readonly key: string; readonly minutes: number | null }> = [
    { key: "manual", minutes: null },
    { key: "15", minutes: 15 },
    { key: "60", minutes: 60 },
    { key: "360", minutes: 360 },
    { key: "1440", minutes: 1440 },
]

/** The key of a table in the picker and in messages. */
export const dbTableKey = (table: DbTableRef): string =>
    `${table.schema}.${table.name ?? table.table ?? ""}`

/** The engine named by a string, or null. */
export const dbEngineOf = (value: string): DbEngine | null => DB_ENGINES.find((engine) => engine === value) ?? null

const mappingSchema = z.object({
    schema: z.string(),
    table: z.string(),
    entity: z.enum(["customer", "order", "product", "transaction", "other"]).catch("other"),
    idColumn: z.string(),
    titleColumn: z.string().catch(""),
    updatedColumn: z.string().catch(""),
    columns: z.array(z.string()).catch([]),
})

/** The saved `tables` value (DataJson) as mappings; a broken value is no tables. */
export const dbMappingsOf = (value: unknown): ReadonlyArray<DbTableMapping> => {
    const parsed = z.array(mappingSchema).safeParse(value)
    return parsed.success ? parsed.data : []
}

/** The saved connection as the wizard holds it; null when its engine is unknown. */
export const dbSavedOf = (wire: DbSavedWire): DbSavedConnection | null => {
    const engine = dbEngineOf(wire.target.engine)
    if (engine === null) return null
    return {
        name: wire.name,
        target: {
            engine,
            host: wire.target.host,
            port: wire.target.port,
            database: wire.target.database,
            user: wire.target.user,
            ssl: wire.target.ssl,
        },
        hasPassword: wire.hasPassword,
        tables: dbMappingsOf(wire.tables),
        everyMinutes: wire.everyMinutes ?? null,
        agentIds: wire.agentIds,
    }
}

const guessColumn = (table: DbTableInfo, names: ReadonlyArray<string>): string =>
    table.columns.find((column) => names.includes(column.name.toLowerCase()))?.name ?? ""

/** A starting mapping for a table the owner just ticked: id / title / updated-at guessed from common names, first columns selected. */
export const dbDefaultMapping = (table: DbTableInfo): DbTableMapping => ({
    schema: table.schema,
    table: table.name,
    entity: "other",
    idColumn: guessColumn(table, ["id", "uuid", "code"]) || (table.columns[0]?.name ?? ""),
    titleColumn: guessColumn(table, ["name", "title", "full_name", "fullname", "email", "ten"]),
    updatedColumn: guessColumn(table, ["updated_at", "updatedat", "modified_at", "last_modified", "updated"]),
    columns: table.columns.slice(0, DB_MAX_COLUMNS).map((column) => column.name),
})
