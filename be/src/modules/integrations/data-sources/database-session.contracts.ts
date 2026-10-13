/** The database engines the hub can read. */
export type DatabaseEngine = "postgres" | "mysql" | "mssql"

/** The engines, for validation. */
export const DATABASE_ENGINES: ReadonlyArray<DatabaseEngine> = ["postgres", "mysql", "mssql"]

/** The most columns brought per table. */
export const DATABASE_MAX_COLUMNS = 30

/** The most rows read per table per sync. */
export const DATABASE_MAX_ROWS = 5000

/** Where and how to reach the owner's database. */
export interface DatabaseTarget {
    /** The engine. */
    readonly engine: DatabaseEngine
    /** The host name or address the owner typed. */
    readonly host: string
    /** The port. */
    readonly port: number
    /** The database name. */
    readonly database: string
    /** The user. */
    readonly user: string
    /** The password in plain text (never stored here). */
    readonly password: string
    /** True to use an encrypted connection. */
    readonly ssl: boolean
}

/** One column of a table. */
export interface DatabaseColumn {
    /** The column name. */
    readonly name: string
    /** The engine's data type name. */
    readonly type: string
}

/** One table or view the user can see. */
export interface DatabaseTable {
    /** The schema. */
    readonly schema: string
    /** The table name. */
    readonly name: string
    /** Its columns. */
    readonly columns: ReadonlyArray<DatabaseColumn>
}

/** The columns picked from one table. */
export interface DatabaseSelection {
    /** The schema. */
    readonly schema: string
    /** The table name. */
    readonly table: string
    /** The column that is the row's stable id. */
    readonly idColumn: string
    /** The column shown as the row's title; empty for none. */
    readonly titleColumn: string
    /** The column that tells when a row changed; empty for none. */
    readonly updatedColumn: string
    /** The columns brought into the hub. */
    readonly columns: ReadonlyArray<string>
}

/** One row read from a table, ready for the hub. */
export interface DatabaseRecord {
    /** The id column's value as text. */
    readonly externalId: string
    /** The title column's value, or the id. */
    readonly title: string
    /** The updated-at value as ISO 8601, when it could be read. */
    readonly occurredAt: string | null
    /** The brought columns. */
    readonly data: Readonly<Record<string, unknown>>
}

/** One page of rows and the cursor to continue from. */
export interface DatabasePage {
    /** The rows. */
    readonly records: ReadonlyArray<DatabaseRecord>
    /** The newest updated-at as text, or null when the table has none or no row had one. */
    readonly cursor: string | null
}

/** The first rows of a table, as text, for the wizard preview. */
export interface DatabasePreview {
    /** The column names. */
    readonly columns: ReadonlyArray<string>
    /** The rows, each cell cut to 80 characters. */
    readonly rows: ReadonlyArray<ReadonlyArray<string>>
}

/** What a table read may be asked for. */
export interface DatabaseReadOptions {
    /** The most rows. */
    readonly limit: number
    /** Only rows updated at or after this value (needs an updated column). */
    readonly cursor?: string | null
}

/** A read only reader for one sync; the session behind it is closed when the sync callback ends. */
export interface DatabaseReader {
    /** Reads one table. */
    readTable(selection: DatabaseSelection, options: DatabaseReadOptions): Promise<DatabasePage>
}

/** A row as the driver answers it. */
export type DatabaseRow = Readonly<Record<string, unknown>>

/** The thin session each engine driver gives. */
export interface DatabaseSession {
    /** The engine. */
    readonly engine: DatabaseEngine
    /** Runs one generated statement. */
    query(sql: string, params?: ReadonlyArray<string>): Promise<ReadonlyArray<DatabaseRow>>
    /** Closes the session; never throws. */
    close(): Promise<void>
}

/** What a sync callback does with a reader; the session behind it is closed when it settles. */
export type DatabaseReadRun<T> = (reader: DatabaseReader) => Promise<T>

/** One generated statement and its parameters. */
export interface DatabaseStatement {
    /** The SQL text. */
    readonly sql: string
    /** The bound parameter values. */
    readonly params: ReadonlyArray<string>
}

/** The TLS settings of a connection: the certificate is not pinned, the host name is the server name. */
export interface DatabaseTlsOptions {
    /** Always false: owners connect to servers with private certificate chains. */
    readonly rejectUnauthorized: boolean
    /** The host name sent as the TLS server name; absent for a bare address. */
    readonly servername?: string
}
