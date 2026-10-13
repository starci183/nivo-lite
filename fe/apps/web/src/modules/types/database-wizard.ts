/** The database engines the wizard offers. */
export type DbEngine = "postgres" | "mysql" | "mssql"

/** What a mapped table's rows become in the hub. */
export type DbEntity = "customer" | "order" | "product" | "transaction" | "other"

/** What the owner typed to reach the database. `password` is empty when the stored one should be kept. */
export interface DbTarget {
    readonly engine: DbEngine
    readonly host: string
    readonly port: number
    readonly database: string
    readonly user: string
    readonly password: string
    readonly ssl: boolean
}

/** One column of a table the connection can see. */
export interface DbColumnInfo {
    readonly name: string
    readonly type: string
}

/** One table or view the connection can see. */
export interface DbTableInfo {
    readonly schema: string
    readonly name: string
    readonly columns: ReadonlyArray<DbColumnInfo>
}

/** One mapped table, as saved in the connection. */
export interface DbTableMapping {
    readonly schema: string
    readonly table: string
    readonly entity: DbEntity
    readonly idColumn: string
    readonly titleColumn: string
    readonly updatedColumn: string
    readonly columns: ReadonlyArray<string>
}

/** The first rows of a mapped table, as text. */
export interface DbPreviewRows {
    readonly columns: ReadonlyArray<string>
    readonly rows: ReadonlyArray<ReadonlyArray<string>>
}

/** What the wizard gets back when it reopens a saved connection (never the password). */
export interface DbSavedConnection {
    readonly name: string
    readonly target: Omit<DbTarget, "password">
    readonly hasPassword: boolean
    readonly tables: ReadonlyArray<DbTableMapping>
    readonly everyMinutes: number | null
    readonly agentIds: ReadonlyArray<string>
}
