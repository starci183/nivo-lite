/** The TLS settings of a session opened to an outside PostgreSQL: the certificate is not pinned, the server name is optional. */
export interface PostgresTlsOptions {
    /** Always false: the peer servers carry private certificate chains. */
    readonly rejectUnauthorized: boolean
    /** The host name sent as the TLS server name; absent for a bare address. */
    readonly servername?: string
}

/** Where and how fast a read-only PostgreSQL session to an outside server connects. */
export interface PostgresSessionTarget {
    /** The resolved address to connect to. */
    readonly host: string
    /** The port. */
    readonly port: number
    /** The user. */
    readonly user: string
    /** The password in plain text. */
    readonly password: string
    /** The database name. */
    readonly database: string
    /** The TLS settings, or false for a clear-text connection. */
    readonly ssl: false | PostgresTlsOptions
    /** How long a connect may take, in milliseconds. */
    readonly connectMs: number
    /** How long one statement may run, in milliseconds. */
    readonly queryMs: number
}

/** One row an outside PostgreSQL server answers: the cells by their column name. */
export interface PostgresRow {
    /** The cells of the row, by column name. */
    readonly [column: string]: unknown
}

/** One read-only session to an outside PostgreSQL; closing it never throws. */
export interface PostgresSession {
    /** Runs one statement and answers its rows. */
    query(text: string, params?: ReadonlyArray<string>): Promise<ReadonlyArray<PostgresRow>>
    /** Closes the session; never throws. */
    close(): Promise<void>
}
