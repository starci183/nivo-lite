import { isIP } from "node:net"
import { openMssqlSession, openMysqlSession, openPostgresSession, selectRows } from "@modules/platform/database"
import type { CustomerSession, PostgresSessionTarget } from "@modules/platform/database"
import type { DatabaseSession, DatabaseTarget, DatabaseTlsOptions } from "./database-session.contracts"
import { toRows } from "./database-values.policy"

/** Seconds are milliseconds here: how long a connect may take. */
export const DATABASE_CONNECT_MS = 10_000

/** How long one statement may run. */
export const DATABASE_QUERY_MS = 15_000

const tlsOf = (target: DatabaseTarget): DatabaseTlsOptions => ({
    rejectUnauthorized: false,
    ...(isIP(target.host) ? {} : { servername: target.host }),
})

const sessionTargetOf = (target: DatabaseTarget, address: string): PostgresSessionTarget => ({
    host: address,
    port: target.port,
    user: target.user,
    password: target.password,
    database: target.database,
    ssl: target.ssl ? tlsOf(target) : false,
    connectMs: DATABASE_CONNECT_MS,
    queryMs: DATABASE_QUERY_MS,
})

const sessionOf = (engine: DatabaseSession["engine"], session: CustomerSession): DatabaseSession => ({
    engine,
    query: (sql, params) => selectRows(session, sql, params),
    close: () => session.close(),
})

/** Opens a read only PostgreSQL session to the resolved address through the platform database client. */
export const openPostgres = async (target: DatabaseTarget, address: string): Promise<DatabaseSession> => {
    const session = await openPostgresSession({
        host: address,
        port: target.port,
        user: target.user,
        password: target.password,
        database: target.database,
        ssl: target.ssl ? tlsOf(target) : false,
        connectMs: DATABASE_CONNECT_MS,
        queryMs: DATABASE_QUERY_MS,
    })
    return {
        engine: "postgres",
        query: async (sql, params) => toRows(await selectRows(session, sql, params)),
        close: () => session.close(),
    }
}

/** Opens a read only MySQL session to the resolved address through the platform database client. */
export const openMysql = async (target: DatabaseTarget, address: string): Promise<DatabaseSession> => {
    const session = await openMysqlSession(sessionTargetOf(target, address))
    return sessionOf("mysql", session)
}

/** Opens a read intent SQL Server session to the resolved address through the platform database client. */
export const openMssql = async (target: DatabaseTarget, address: string): Promise<DatabaseSession> => {
    const session = await openMssqlSession(sessionTargetOf(target, address))
    return sessionOf("mssql", session)
}
