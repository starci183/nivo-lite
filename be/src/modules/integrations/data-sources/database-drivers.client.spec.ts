import type { DatabaseTarget } from "./database-session.contracts"
import { DATABASE_CONNECT_MS, DATABASE_QUERY_MS, openMssql, openMysql, openPostgres } from "./database-drivers.client"

interface QueryCall {
    readonly sql: string
    readonly params: ReadonlyArray<unknown> | undefined
}

class DriverControl {
    connectError: Error | undefined = undefined
    setError: Error | undefined = undefined
    endError: Error | undefined = undefined
    executionError: Error | undefined = undefined
    rows: Array<Record<string, unknown>> = [{ id: "1" }]
    reset(): void {
        this.connectError = undefined
        this.setError = undefined
        this.endError = undefined
        this.executionError = undefined
        this.rows = [{ id: "1" }]
    }
}

const mockPg = new DriverControl()
const mockMysql = new DriverControl()
const mockMssql = new DriverControl()
const mockPgClients: Array<{
    config: Record<string, unknown>
    queries: Array<QueryCall>
    listeners: Record<string, () => void>
}> = []
const mockMysqlClients: Array<{ config: Record<string, unknown>; queries: Array<QueryCall>; destroyed: boolean }> = []
const mockMssqlPools: Array<{
    config: Record<string, unknown>
    inputs: Array<{ name: string; value: string }>
    closed: boolean
}> = []

jest.mock("pg", () => ({
    Client: class {
        readonly config: Record<string, unknown>
        readonly queries: Array<QueryCall> = []
        readonly listeners: Record<string, () => void> = {}

        constructor(config: Record<string, unknown>) {
            this.config = config
            mockPgClients.push(this)
        }

        on(event: string, listener: () => void): void {
            this.listeners[event] = listener
        }

        connect(): Promise<void> {
            return mockPg.connectError === undefined ? Promise.resolve() : Promise.reject(mockPg.connectError)
        }

        query(sql: string, params?: ReadonlyArray<unknown>): Promise<{ rows: Array<Record<string, unknown>> }> {
            this.queries.push({ sql, params })
            if (sql.startsWith("SET SESSION") && mockPg.setError !== undefined) return Promise.reject(mockPg.setError)
            return Promise.resolve({ rows: mockPg.rows })
        }

        end(): Promise<void> {
            return mockPg.endError === undefined ? Promise.resolve() : Promise.reject(mockPg.endError)
        }
    },
}))

jest.mock("mysql2/promise", () => ({
    createConnection: (config: Record<string, unknown>) => {
        const client = {
            config,
            queries: new Array<QueryCall>(),
            destroyed: false,
            on(event: string, listener: () => void): void {
                if (event === "error") listener()
            },
            query(sqlOrOptions: string | { sql: string; values?: ReadonlyArray<unknown> }): Promise<unknown> {
                const sql = typeof sqlOrOptions === "string" ? sqlOrOptions : sqlOrOptions.sql
                const params = typeof sqlOrOptions === "string" ? undefined : sqlOrOptions.values
                client.queries.push({ sql, params })
                if (sql.startsWith("SET SESSION TRANSACTION") && mockMysql.setError !== undefined) {
                    return Promise.reject(mockMysql.setError)
                }
                if (sql.startsWith("SET SESSION MAX_EXECUTION_TIME") && mockMysql.executionError !== undefined) {
                    return Promise.reject(mockMysql.executionError)
                }
                return Promise.resolve([mockMysql.rows])
            },
            destroy(): void {
                client.destroyed = true
            },
            end(): Promise<void> {
                return mockMysql.endError === undefined ? Promise.resolve() : Promise.reject(mockMysql.endError)
            },
        }
        mockMysqlClients.push(client)
        return mockMysql.connectError === undefined ? Promise.resolve(client) : Promise.reject(mockMysql.connectError)
    },
}))

jest.mock("mssql", () => ({
    NVarChar: "nvarchar",
    ConnectionPool: class {
        readonly config: Record<string, unknown>
        readonly inputs: Array<{ name: string; value: string }> = []
        closed = false
        private listener: (() => void) | undefined

        constructor(config: Record<string, unknown>) {
            this.config = config
            mockMssqlPools.push(this)
        }

        on(_event: string, listener: () => void): void {
            this.listener = listener
        }

        connect(): Promise<void> {
            this.listener?.()
            return mockMssql.connectError === undefined ? Promise.resolve() : Promise.reject(mockMssql.connectError)
        }

        request() {
            return {
                input: (name: string, _type: string, value: string) => {
                    this.inputs.push({ name, value })
                },
                query: (sql: string) => {
                    this.inputs.push({ name: sql, value: "" })
                    return Promise.resolve({ recordset: mockMssql.rows })
                },
            }
        }

        close(): Promise<void> {
            this.closed = true
            return mockMssql.endError === undefined ? Promise.resolve() : Promise.reject(mockMssql.endError)
        }
    },
}))

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
        mockPg.reset()
        mockMysql.reset()
        mockMssql.reset()
        mockPgClients.length = 0
        mockMysqlClients.length = 0
        mockMssqlPools.length = 0
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
            client?.listeners.error?.()
            await expect(session.query("select 1", ["a"])).resolves.toEqual([{ id: "1" }])
            await expect(session.query("select 2")).resolves.toEqual([{ id: "1" }])
            expect(client?.queries[1]).toEqual({ sql: "select 1", params: ["a"] })
            expect(client?.queries[2]).toEqual({ sql: "select 2", params: undefined })
            await session.close()
        })

        it("skips the server name for an address and for a clear-text connection", async () => {
            await openPostgres(target({ host: "203.0.113.5", ssl: true }), "203.0.113.5")
            await openPostgres(target({ ssl: false }), "203.0.113.5")

            expect(mockPgClients[0]?.config.ssl).toEqual({ rejectUnauthorized: false })
            expect(mockPgClients[1]?.config.ssl).toBe(false)
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

            expect(mockMysqlClients[0]?.config.ssl).toBeUndefined()
            expect(mockMysqlClients[1]?.config.ssl).toEqual({ rejectUnauthorized: false })
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
