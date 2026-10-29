import { DataSource } from "typeorm"
import type { CustomerRow, CustomerSession } from "./customer-sessions.contracts"
import type { PostgresSessionTarget } from "./postgres-session.contracts"

const MYSQL_READ_ONLY = "SET SESSION TRANSACTION READ ONLY"

/** The part of a TypeORM connection a session uses: statement text in, an answer out. */
interface SessionRunner {
    /** Runs one statement and answers what the driver answered. */
    query<T>(text: string, params?: Array<unknown>): Promise<T>
}

const isRow = (value: unknown): value is CustomerRow =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** A driver answer as rows; anything else (an update count, say) is no rows. */
const rowsOf = (value: unknown): ReadonlyArray<CustomerRow> => (Array.isArray(value) ? value.filter(isRow) : [])

/** Destroys a connection without ever letting a close failure escape. */
const closeQuietly = (source: DataSource): Promise<void> =>
    source.destroy().then(
        () => undefined,
        () => undefined,
    )

const sessionOf = (source: DataSource, runner: SessionRunner): CustomerSession => ({
    query: async (text, params) =>
        rowsOf(await runner.query<unknown>(text, params === undefined ? undefined : [...params])),
    close: () => closeQuietly(source),
})

/** Runs the session setup statements; one refusal closes what was opened. */
const prepared = async (source: DataSource, setup: () => Promise<unknown>): Promise<void> => {
    await source.initialize()
    try {
        await setup()
    } catch (error) {
        await closeQuietly(source)
        throw error
    }
}

/** Runs one statement on a session and answers its rows: the one place the platform lets callers reach a customer's server. */
export const selectRows = (
    session: CustomerSession,
    text: string,
    params?: ReadonlyArray<string>,
): Promise<ReadonlyArray<CustomerRow>> => (params === undefined ? session.query(text) : session.query(text, params))

/** Opens a read only MySQL session through the TypeORM client: one connection, read only, with connect and statement limits. */
export const openMysqlSession = async (target: PostgresSessionTarget): Promise<CustomerSession> => {
    const source = new DataSource({
        type: "mysql",
        host: target.host,
        port: target.port,
        username: target.user,
        password: target.password,
        database: target.database,
        connectTimeout: target.connectMs,
        ssl: target.ssl === false ? undefined : target.ssl,
        supportBigNumbers: true,
        bigNumberStrings: true,
        poolSize: 1,
        synchronize: false,
    })
    const runner: SessionRunner = source
    await prepared(source, async () => {
        await runner.query(MYSQL_READ_ONLY)
        await runner.query(`SET SESSION MAX_EXECUTION_TIME=${target.queryMs}`).then(
            () => undefined,
            () => undefined,
        )
    })
    return sessionOf(source, runner)
}

/** Opens a read intent SQL Server session through the TypeORM client; parameters bind as `@0`, `@1`, ... */
export const openMssqlSession = async (target: PostgresSessionTarget): Promise<CustomerSession> => {
    const source = new DataSource({
        type: "mssql",
        host: target.host,
        port: target.port,
        username: target.user,
        password: target.password,
        database: target.database,
        connectionTimeout: target.connectMs,
        requestTimeout: target.queryMs,
        pool: { max: 1, min: 0 },
        options: {
            encrypt: target.ssl !== false,
            trustServerCertificate: true,
            readOnlyIntent: true,
            serverName: target.ssl === false ? undefined : target.ssl.servername,
        },
        synchronize: false,
    })
    await source.initialize()
    return sessionOf(source, source)
}
