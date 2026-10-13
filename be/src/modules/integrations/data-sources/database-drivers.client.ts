import { isIP } from "node:net"
import { ConnectionPool, NVarChar } from "mssql"
import { createConnection } from "mysql2/promise"
import { Client } from "pg"
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

/** Opens a read only PostgreSQL session to the resolved address. */
export const openPostgres = async (target: DatabaseTarget, address: string): Promise<DatabaseSession> => {
    const client = new Client({
        host: address,
        port: target.port,
        user: target.user,
        password: target.password,
        database: target.database,
        ssl: target.ssl ? tlsOf(target) : false,
        connectionTimeoutMillis: DATABASE_CONNECT_MS,
        statement_timeout: DATABASE_QUERY_MS,
        query_timeout: DATABASE_QUERY_MS,
        options: "-c default_transaction_read_only=on",
    })
    client.on("error", () => undefined)
    await client.connect()
    try {
        await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
    } catch (error) {
        await client.end().then(
            () => undefined,
            () => undefined,
        )
        throw error
    }
    return {
        engine: "postgres",
        query: async (sql, params) =>
            toRows((await client.query(sql, params === undefined ? undefined : [...params])).rows),
        close: () =>
            client.end().then(
                () => undefined,
                () => undefined,
            ),
    }
}

/** Opens a read only MySQL session to the resolved address. */
export const openMysql = async (target: DatabaseTarget, address: string): Promise<DatabaseSession> => {
    const connection = await createConnection({
        host: address,
        port: target.port,
        user: target.user,
        password: target.password,
        database: target.database,
        connectTimeout: DATABASE_CONNECT_MS,
        ssl: target.ssl ? tlsOf(target) : undefined,
        supportBigNumbers: true,
        bigNumberStrings: true,
        multipleStatements: false,
    })
    connection.on("error", () => undefined)
    try {
        await connection.query("SET SESSION TRANSACTION READ ONLY")
        await connection.query(`SET SESSION MAX_EXECUTION_TIME=${DATABASE_QUERY_MS}`).then(
            () => undefined,
            () => undefined,
        )
    } catch (error) {
        connection.destroy()
        throw error
    }
    return {
        engine: "mysql",
        query: async (sql, params) => {
            const [rows] = await connection.query({
                sql,
                values: params === undefined ? [] : [...params],
                timeout: DATABASE_QUERY_MS,
            })
            return toRows(rows)
        },
        close: () =>
            connection.end().then(
                () => undefined,
                () => connection.destroy(),
            ),
    }
}

/** Opens a read intent SQL Server session to the resolved address. */
export const openMssql = async (target: DatabaseTarget, address: string): Promise<DatabaseSession> => {
    const pool = new ConnectionPool({
        server: address,
        port: target.port,
        user: target.user,
        password: target.password,
        database: target.database,
        connectionTimeout: DATABASE_CONNECT_MS,
        requestTimeout: DATABASE_QUERY_MS,
        pool: { max: 1, min: 0 },
        options: {
            encrypt: target.ssl,
            trustServerCertificate: true,
            readOnlyIntent: true,
            ...(target.ssl && !isIP(target.host) ? { serverName: target.host } : {}),
        },
    })
    pool.on("error", () => undefined)
    await pool.connect()
    return {
        engine: "mssql",
        query: async (sql, params) => {
            const request = pool.request()
            ;(params ?? []).forEach((value, index) => request.input(`p${index}`, NVarChar, value))
            return toRows((await request.query(sql)).recordset)
        },
        close: () =>
            pool.close().then(
                () => undefined,
                () => undefined,
            ),
    }
}
