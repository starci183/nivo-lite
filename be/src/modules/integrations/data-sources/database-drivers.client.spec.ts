import { mock } from "@starci/jest-preset"
import mssql from "mssql"
import type { ConnectionPool, IRecordSet, IResult, Request } from "mssql"
import mysql from "mysql2/promise"
import type { Connection, RowDataPacket } from "mysql2/promise"
import pg from "pg"
import type { Client, QueryResult } from "pg"
import type { DatabaseTarget } from "./database-session.contracts"
import { DATABASE_CONNECT_MS, DATABASE_QUERY_MS, openMssql, openMysql, openPostgres } from "./database-drivers.client"

interface QueryCall {
    readonly sql: string
    readonly params: unknown
}

/** How one fake driver answers: the failures to raise and the rows to read. */
class DriverControl {
    connectError: Error | undefined = undefined
    setError: Error | undefined = undefined
    endError: Error | undefined = undefined
    executionError: Error | undefined = undefined
}

const ROW = { id: "1" }

const mockPg = new DriverControl()
const mockMysql = new DriverControl()
const mockMssql = new DriverControl()

interface PgOpened {
    readonly config: unknown
    readonly queries: Array<QueryCall>
    readonly listeners: Map<string, (...args: Array<never>) => void>
}

interface MysqlOpened {
    readonly config: unknown
    readonly queries: Array<QueryCall>
    destroyed: boolean
}

interface MssqlOpened {
    readonly config: unknown
    readonly inputs: Array<{ name: string; value: unknown }>
    closed: boolean
}

const mockPgClients: Array<PgOpened> = []
const mockMysqlClients: Array<MysqlOpened> = []
const mockMssqlPools: Array<MssqlOpened> = []

const pgResult = (): QueryResult => ({ rows: [{ ...ROW }], command: "SELECT", rowCount: 1, oid: 0, fields: [] })

/** A pg client over the control of the running test. */
const pgClientOf = (config?: unknown): Client => {
    const control = mockPg
    const opened: PgOpened = { config, queries: [], listeners: new Map() }
    mockPgClients.push(opened)
    const client = mock<Client>()
    client.on.mockImplementation((event, listener) => {
        opened.listeners.set(event, listener)
        return client
    })
    jest.mocked<() => Promise<Client>>(client.connect).mockImplementation(() =>
        control.connectError === undefined ? Promise.resolve(client) : Promise.reject(control.connectError),
    )
    jest.mocked<(sql: string, params?: Array<unknown>) => Promise<QueryResult>>(client.query).mockImplementation(
        (sql, params) => {
            opened.queries.push({ sql, params })
            if (sql.startsWith("SET SESSION") && control.setError !== undefined) return Promise.reject(control.setError)
            return Promise.resolve(pgResult())
        },
    )
    jest.mocked<() => Promise<void>>(client.end).mockImplementation(() =>
        control.endError === undefined ? Promise.resolve() : Promise.reject(control.endError),
    )
    return client
}

/** A mysql connection over the control of the running test. */
const mysqlConnectionOf = (config: unknown): Promise<Connection> => {
    const control = mockMysql
    const opened: MysqlOpened = { config, queries: [], destroyed: false }
    mockMysqlClients.push(opened)
    const connection = mock<Connection>()
    connection.on.mockImplementation((event, listener) => {
        if (event === "error") listener()
        return connection
    })
    connection.query.mockImplementation((sqlOrOptions: unknown) => {
        const sql = typeof sqlOrOptions === "string" ? sqlOrOptions : String(Reflect.get(Object(sqlOrOptions), "sql"))
        const params = typeof sqlOrOptions === "string" ? undefined : Reflect.get(Object(sqlOrOptions), "values")
        opened.queries.push({ sql, params })
        if (sql.startsWith("SET SESSION TRANSACTION") && control.setError !== undefined) {
            return Promise.reject(control.setError)
        }
        if (sql.startsWith("SET SESSION MAX_EXECUTION_TIME") && control.executionError !== undefined) {
            return Promise.reject(control.executionError)
        }
        return Promise.resolve([[Object.assign(mock<RowDataPacket>(), ROW)], []])
    })
    connection.destroy.mockImplementation(() => {
        opened.destroyed = true
    })
    connection.end.mockImplementation(() =>
        control.endError === undefined ? Promise.resolve() : Promise.reject(control.endError),
    )
    return control.connectError === undefined ? Promise.resolve(connection) : Promise.reject(control.connectError)
}

const recordSet = (): IRecordSet<unknown> =>
    Object.assign([{ ...ROW }], { columns: {}, toTable: () => new mssql.Table() })

/** A mssql pool over the control of the running test. */
const mssqlPoolOf = (config: unknown): ConnectionPool => {
    const control = mockMssql
    const opened: MssqlOpened = { config, inputs: [], closed: false }
    mockMssqlPools.push(opened)
    const pool = mock<ConnectionPool>()
    let onError: () => void = () => undefined
    pool.on.mockImplementation((_event, listener) => {
        onError = listener
        return pool
    })
    jest.mocked<() => Promise<ConnectionPool>>(pool.connect).mockImplementation(() => {
        onError()
        return control.connectError === undefined ? Promise.resolve(pool) : Promise.reject(control.connectError)
    })
    pool.request.mockImplementation(() => {
        const request = mock<Request>()
        request.input.mockImplementation((name: string, _type: unknown, value: unknown) => {
            opened.inputs.push({ name, value })
            return request
        })
        jest.mocked<(sql: string) => Promise<IResult<unknown>>>(request.query).mockImplementation((sql) => {
            opened.inputs.push({ name: String(sql), value: "" })
            const result: IResult<unknown> = {
                recordsets: [recordSet()],
                recordset: recordSet(),
                rowsAffected: [1],
                output: {},
            }
            return Promise.resolve(result)
        })
        return request
    })
    jest.mocked<() => Promise<void>>(pool.close).mockImplementation(() => {
        opened.closed = true
        return control.endError === undefined ? Promise.resolve() : Promise.reject(control.endError)
    })
    return pool
}

const pgSpy = jest.spyOn(pg, "Client")
const mysqlSpy = jest.spyOn(mysql, "createConnection")
const mssqlSpy = jest.spyOn(mssql, "ConnectionPool")

const target = (partial: Partial<DatabaseTarget> = {}): DatabaseTarget => ({
    engine: "postgres",
    host: "db.example",
    port: 5432,
    database: "shop",
    user: "nivo",
    password: "secret",
    ssl: true,
    ...partial,
})

describe("database drivers", () => {
    beforeEach(() => {
        Object.assign(mockPg, new DriverControl())
        Object.assign(mockMysql, new DriverControl())
        Object.assign(mockMssql, new DriverControl())
        mockPgClients.length = 0
        mockMysqlClients.length = 0
        mockMssqlPools.length = 0
        pgSpy.mockImplementation(pgClientOf)
        mysqlSpy.mockImplementation(mysqlConnectionOf)
        mssqlSpy.mockImplementation(mssqlPoolOf)
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    describe("openPostgres", () => {
        it("connects read only, with the host name as the TLS server name", async () => {
            const session = await openPostgres(target(), "203.0.113.5")
            const client = mockPgClients[0]

            expect(client?.config).toMatchObject({
                host: "203.0.113.5",
                port: 5432,
                user: "nivo",
                password: "secret",
                database: "shop",
                connectionTimeoutMillis: DATABASE_CONNECT_MS,
                statement_timeout: DATABASE_QUERY_MS,
                query_timeout: DATABASE_QUERY_MS,
                options: "-c default_transaction_read_only=on",
                ssl: { rejectUnauthorized: false, servername: "db.example" },
            })
            client?.listeners.get("error")?.()
            await expect(session.query("select 1", ["a"])).resolves.toEqual([{ id: "1" }])
            await expect(session.query("select 2")).resolves.toEqual([{ id: "1" }])
            expect(client?.queries[1]).toEqual({ sql: "select 1", params: ["a"] })
            expect(client?.queries[2]).toEqual({ sql: "select 2", params: undefined })
            await session.close()
        })

        it("skips the server name for an address and for a clear-text connection", async () => {
            await openPostgres(target({ host: "203.0.113.5", ssl: true }), "203.0.113.5")
            await openPostgres(target({ ssl: false }), "203.0.113.5")

            expect(mockPgClients[0]?.config).toHaveProperty("ssl", { rejectUnauthorized: false })
            expect(mockPgClients[1]?.config).toHaveProperty("ssl", false)
        })

        it("closes the connection when the read-only setting is refused, even if closing fails", async () => {
            const refused = new Error("readonly")
            mockPg.setError = refused
            await expect(openPostgres(target(), "203.0.113.5")).rejects.toBe(refused)

            mockPg.endError = new Error("end")
            await expect(openPostgres(target(), "203.0.113.5")).rejects.toBe(refused)
        })

        it("swallows a failure while closing a live session", async () => {
            const session = await openPostgres(target(), "203.0.113.5")
            mockPg.endError = new Error("end")

            await expect(session.close()).resolves.toBeUndefined()
        })
    })

    describe("openMysql", () => {
        it("sets a read-only session and ignores a server that has no execution-time limit", async () => {
            mockMysql.executionError = new Error("unknown variable")
            const session = await openMysql(target({ engine: "mysql", port: 3306 }), "203.0.113.8")

            expect(mockMysqlClients[0]?.config).toMatchObject({
                host: "203.0.113.8",
                port: 3306,
                connectTimeout: DATABASE_CONNECT_MS,
                ssl: { rejectUnauthorized: false, servername: "db.example" },
                multipleStatements: false,
            })
            await expect(session.query("select 1")).resolves.toEqual([{ id: "1" }])
            await expect(session.query("select 2", ["b"])).resolves.toEqual([{ id: "1" }])
            expect(mockMysqlClients[0]?.queries.at(-1)).toEqual({ sql: "select 2", params: ["b"] })
            await session.close()
        })

        it("uses no TLS object for a clear-text connection and drops the server name of an address", async () => {
            await openMysql(target({ engine: "mysql", ssl: false }), "203.0.113.8")
            await openMysql(target({ engine: "mysql", host: "203.0.113.8" }), "203.0.113.8")

            expect(mockMysqlClients[0]?.config).toHaveProperty("ssl", undefined)
            expect(mockMysqlClients[1]?.config).toHaveProperty("ssl", { rejectUnauthorized: false })
        })

        it("destroys the connection when the read-only setting is refused", async () => {
            const refused = new Error("readonly")
            mockMysql.setError = refused

            await expect(openMysql(target({ engine: "mysql" }), "203.0.113.8")).rejects.toBe(refused)
            expect(mockMysqlClients[0]?.destroyed).toBe(true)
        })

        it("destroys the connection when ending it fails", async () => {
            const session = await openMysql(target({ engine: "mysql" }), "203.0.113.8")
            mockMysql.endError = new Error("end")

            await session.close()

            expect(mockMysqlClients[0]?.destroyed).toBe(true)
        })
    })

    describe("openMssql", () => {
        it("names the server only for an encrypted host name and binds each parameter", async () => {
            const session = await openMssql(target({ engine: "mssql", port: 1433 }), "203.0.113.9")

            expect(mockMssqlPools[0]?.config).toMatchObject({
                server: "203.0.113.9",
                port: 1433,
                connectionTimeout: DATABASE_CONNECT_MS,
                requestTimeout: DATABASE_QUERY_MS,
                options: {
                    encrypt: true,
                    trustServerCertificate: true,
                    readOnlyIntent: true,
                    serverName: "db.example",
                },
            })
            await expect(session.query("select 1", ["a", "b"])).resolves.toEqual([{ id: "1" }])
            await expect(session.query("select 2")).resolves.toEqual([{ id: "1" }])
            expect(mockMssqlPools[0]?.inputs).toEqual([
                { name: "p0", value: "a" },
                { name: "p1", value: "b" },
                { name: "select 1", value: "" },
                { name: "select 2", value: "" },
            ])
            await session.close()
            expect(mockMssqlPools[0]?.closed).toBe(true)
        })

        it("omits the server name for a clear-text connection and for an address", async () => {
            await openMssql(target({ engine: "mssql", ssl: false }), "203.0.113.9")
            await openMssql(target({ engine: "mssql", host: "203.0.113.9" }), "203.0.113.9")

            expect(mockMssqlPools[0]?.config).toMatchObject({ options: { encrypt: false } })
            expect(mockMssqlPools[1]?.config).toMatchObject({ options: { encrypt: true } })
            expect(JSON.stringify(mockMssqlPools[0]?.config)).not.toContain("serverName")
            expect(JSON.stringify(mockMssqlPools[1]?.config)).not.toContain("serverName")
        })

        it("swallows a failure while closing the pool", async () => {
            const session = await openMssql(target({ engine: "mssql" }), "203.0.113.9")
            mockMssql.endError = new Error("close")

            await expect(session.close()).resolves.toBeUndefined()
        })
    })
})
