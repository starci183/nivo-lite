import type {
    DbEngine,
    DbEntity,
    DbPreviewRows,
    DbSavedConnection,
    DbTableInfo,
    DbTableMapping,
    DbTarget,
} from "@/modules/types"
import { DB_ENGINES } from "@/modules/utils"
import { z } from "zod"
import type { DatabaseTargetValues } from "@/hooks/rhf"
import type { DatabaseWizardState } from "./useDatabaseWizard"

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

/** The steps of the database wizard, in order. */
export const DB_STEPS = ["connect", "tables", "schedule", "agent"] as const

/** The entities a table can become. */
export const DB_ENTITIES: ReadonlyArray<DbEntity> = ["customer", "order", "product", "transaction", "other"]

/** The most columns brought per table. */
export const DB_MAX_COLUMNS = 30

/** The most rows read per table per sync. */
export const DB_MAX_ROWS = 5000

/** The sync periods the wizard offers; `minutes` null is manual only. */
export const DB_SCHEDULES: ReadonlyArray<{
    readonly key: "manual" | "15" | "60" | "360" | "1440"
    readonly minutes: number | null
}> = [
    { key: "manual", minutes: null },
    { key: "15", minutes: 15 },
    { key: "60", minutes: 60 },
    { key: "360", minutes: 360 },
    { key: "1440", minutes: 1440 },
]

/** The key of a table in the picker and in messages. */
export const dbTableKey = (table: DbTableRef): string => `${table.schema}.${table.name ?? table.table ?? ""}`

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

/** The select value that stands for "no column" in the optional column pickers. */
export const DB_NO_COLUMN = "__none"

/** The entity named by a select value; anything unknown is `other`. */
export const dbEntityOf = (value: string | null): DbEntity => DB_ENTITIES.find((entity) => entity === value) ?? "other"

/** An optional column picked in a select: the column name, or "" for none. */
export const dbOptionalColumnOf = (value: string | null): string => (!value || value === DB_NO_COLUMN ? "" : value)

/** The columns of a table as select options: the name and its type. */
export const dbColumnOptions = (table: DbTableInfo): ReadonlyArray<{ readonly id: string; readonly label: string }> =>
    table.columns.map((column) => ({ id: column.name, label: `${column.name} (${column.type})` }))

/** The preview rows as lines: each cell named by its column, with a stable id per row position. */
export const dbPreviewLines = (preview: DbPreviewRows): ReadonlyArray<{ readonly id: string; readonly text: string }> =>
    preview.rows.map((row, position) => ({
        id: `row-${position}`,
        text: preview.columns.map((column, cell) => `${column}: ${row[cell] ?? ""}`).join(" · "),
    }))

/** Only digits, at most 5: what the port field keeps of what is typed. */
export const dbPortOf = (value: string): string => value.replace(/\D/g, "").slice(0, 5)

/** Restores a saved connection or prepares the initial wizard state. */
export const stateOf = (
    resumeId: string | undefined,
    saved: DbSavedConnection | null,
    loadError?: string,
): DatabaseWizardState => ({
    index: 0,
    passwordKept: false,
    connId: resumeId,
    tables: null,
    picked: saved?.tables ?? [],
    everyMinutes: saved === null ? 60 : saved.everyMinutes,
    agentIds: saved?.agentIds ?? [],
    error: loadError ?? null,
    found: null,
})

/** Normalizes database form values into the target sent by commands. */
export const databaseTargetOf = (values: DatabaseTargetValues): DbTarget => ({
    engine: values.engine,
    host: values.host.trim(),
    port: Number(values.port),
    database: values.database.trim(),
    user: values.user.trim(),
    password: values.password,
    ssl: values.ssl,
})
