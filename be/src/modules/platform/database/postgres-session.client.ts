import { DataSource } from "typeorm"
import type { PostgresRow, PostgresSession, PostgresSessionTarget } from "./postgres-session.contracts"
import { POSTGRES_SESSION_READ_ONLY } from "./persistence/postgres-session.sql"

/** The part of a TypeORM connection a session uses: statement text in, rows out. */
interface SessionRunner {
    /** Runs one statement and answers its rows. */
    query<T>(text: string, params?: Array<unknown>): Promise<T>
}

/** Destroys a connection without ever letting a close failure escape. */
const closeQuietly = (source: DataSource): Promise<void> =>
    source.destroy().then(
        () => undefined,
        () => undefined,
    )

/**
 * Opens a read only PostgreSQL session to the resolved target through the TypeORM client the database capability
 * already owns. The session is read only at connection and statement level, connect and query have time limits,
 * and one refusal while the read-only setting is applied closes what was opened.
 */
export const openPostgresSession = async (target: PostgresSessionTarget): Promise<PostgresSession> => {
    const source = new DataSource({
        type: "postgres",
        host: target.host,
        port: target.port,
        username: target.user,
        password: target.password,
        database: target.database,
        ssl: target.ssl,
        connectTimeoutMS: target.connectMs,
        synchronize: false,
        extra: {
            options: "-c default_transaction_read_only=on",
            statement_timeout: target.queryMs,
            query_timeout: target.queryMs,
            max: 1,
        },
    })
    const runner: SessionRunner = source
    await source.initialize()
    try {
        await runner.query(POSTGRES_SESSION_READ_ONLY)
    } catch (error) {
        await closeQuietly(source)
        throw error
    }
    return {
        query: (text, params) => runner.query<Array<PostgresRow>>(text, params === undefined ? undefined : [...params]),
        close: () => closeQuietly(source),
    }
}
