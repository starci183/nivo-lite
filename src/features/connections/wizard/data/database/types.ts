/** Shapes shared by the database wizard (browser) and its server actions. Nothing here is secret. */

export type Engine = "postgres" | "mysql" | "mssql"
export const ENGINES: ReadonlyArray<Engine> = ["postgres", "mysql", "mssql"]
export const DEFAULT_PORT: Readonly<Record<Engine, number>> = { postgres: 5432, mysql: 3306, mssql: 1433 }
export const ENGINE_LABEL: Readonly<Record<Engine, string>> = { postgres: "PostgreSQL", mysql: "MySQL", mssql: "SQL Server" }

export type DbEntity = "customer" | "order" | "product" | "transaction" | "other"
export const DB_ENTITIES: ReadonlyArray<DbEntity> = ["customer", "order", "product", "transaction", "other"]

/** The caps from the brief: columns brought per table, rows per table per sync. */
export const MAX_COLUMNS = 30
export const MAX_ROWS = 5000

/** What the owner typed to reach the database. `password` is empty when the stored one should be kept. */
export type DbTarget = {
  readonly engine: Engine
  readonly host: string
  readonly port: number
  readonly database: string
  readonly user: string
  readonly password: string
  readonly ssl: boolean
}

export type ColumnInfo = { readonly name: string; readonly type: string }
export type TableInfo = { readonly schema: string; readonly name: string; readonly columns: ReadonlyArray<ColumnInfo> }

/** One mapped table. Stored (not secret) in the connection's public_meta under `config`. */
export type TableMapping = {
  readonly schema: string
  readonly table: string
  readonly entity: DbEntity
  readonly idColumn: string
  readonly titleColumn: string
  readonly updatedColumn: string
  readonly columns: ReadonlyArray<string>
}

export type DbConfig = { readonly tables: ReadonlyArray<TableMapping> }

export const tableKey = (t: { readonly schema: string; readonly name?: string; readonly table?: string }): string => `${t.schema}.${t.name ?? t.table ?? ""}`

/** What the wizard gets back when it reopens a saved connection (never the password). */
export type SavedDatabase = {
  readonly name: string
  readonly target: Omit<DbTarget, "password">
  readonly hasPassword: boolean
  readonly tables: ReadonlyArray<TableMapping>
  readonly everyMinutes: number | null
  readonly agentIds: ReadonlyArray<string>
}

export type PreviewRows = { readonly columns: ReadonlyArray<string>; readonly rows: ReadonlyArray<ReadonlyArray<string>> }
