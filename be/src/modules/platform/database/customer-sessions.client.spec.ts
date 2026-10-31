import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DataSource } from "typeorm"
import type { CustomerSession } from "./customer-sessions.contracts"
import type { PostgresSessionTarget } from "./postgres-session.contracts"
import { openMssqlSession, openMysqlSession, selectRows } from "./customer-sessions.client"

const SUBJECT = Symbol("customer-sessions.client")

type PolicySubject = {
    openMysqlSession: typeof openMysqlSession
    openMssqlSession: typeof openMssqlSession
    selectRows: typeof selectRows
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { openMysqlSession, openMssqlSession, selectRows } }],
    }).compile()
    return moduleRef.get<PolicySubject>(SUBJECT)
}

/** How the fake connections answer: the failures to raise and the answer to give. */
class DriverControl {
    connectError: Error | undefined = undefined
    setError: Error | undefined = undefined
    executionError: Error | undefined = undefined
    destroyError: Error | undefined = undefined
    answer: unknown = [{ id: "1" }]
}

interface Opened {
    readonly options: unknown
    readonly queries: Array<{ sql: string; params: unknown }>
    destroyed: boolean
}

const control = new DriverControl()
const opened: Array<Opened> = []

const recordOf = (source: DataSource): Opened => {
    const found = opened.find((entry) => entry.options === source.options)
    if (found !== undefined) return found
    const record: Opened = { options: source.options, queries: [], destroyed: false }
    opened.push(record)
    return record
}

const answerTo = (sql: string): Promise<unknown> => {
    if (sql.startsWith("SET SESSION TRANSACTION") && control.setError !== undefined) {
        return Promise.reject(control.setError)
    }
    if (sql.startsWith("SET SESSION MAX_EXECUTION_TIME") && control.executionError !== undefined) {
        return Promise.reject(control.executionError)
    }
    return Promise.resolve(control.answer)
}

const registerDoubles = () => {
    beforeEach(() => {
        Object.assign(control, new DriverControl())
        opened.length = 0
        jest.spyOn(DataSource.prototype, "initialize").mockImplementation(function (this: DataSource) {
            recordOf(this)
            return control.connectError === undefined ? Promise.resolve(this) : Promise.reject(control.connectError)
        })
        jest.spyOn(DataSource.prototype, "query").mockImplementation(function (
            this: DataSource,
            sql: string,
            params?: unknown,
        ) {
            recordOf(this).queries.push({ sql, params })
            return answerTo(sql)
        })
        jest.spyOn(DataSource.prototype, "destroy").mockImplementation(function (this: DataSource) {
            recordOf(this).destroyed = true
            return control.destroyError === undefined ? Promise.resolve() : Promise.reject(control.destroyError)
        })
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })
}

const target = (partial: Partial<PostgresSessionTarget> = {}): PostgresSessionTarget => ({
    host: "203.0.113.8",
    port: 3306,
    user: "nivo",
    password: "secret",
    database: "shop",
    ssl: { rejectUnauthorized: false, servername: "db.example" },
    connectMs: 10_000,
    queryMs: 15_000,
    ...partial,
})

const registerSelectRows = () => {
    describe("selectRows", () => {
        it("runs the statement on the session with its parameters", async () => {
            const subject = await buildSubject()
            const session = mock<CustomerSession>()
            session.query.mockResolvedValue([{ id: "1" }])

            await expect(subject.selectRows(session, "select 1", ["a"])).resolves.toEqual([{ id: "1" }])
            expect(session.query).toHaveBeenCalledWith("select 1", ["a"])
        })

        it("hands the session no parameter list when there is none", async () => {
            const subject = await buildSubject()
            const session = mock<CustomerSession>()
            session.query.mockResolvedValue([])

            await subject.selectRows(session, "select 2")

            expect(session.query).toHaveBeenCalledWith("select 2")
        })
    })
}

const registerMysql = () => {
    describe("openMysqlSession", () => {
        it("opens one read only connection with the limits of the target and answers rows", async () => {
            const subject = await buildSubject()
            control.executionError = new Error("unknown variable")

            const session = await subject.openMysqlSession(target())

            expect(opened[0]?.options).toMatchObject({
                type: "mysql",
                host: "203.0.113.8",
                port: 3306,
                username: "nivo",
                password: "secret",
                database: "shop",
                connectTimeout: 10_000,
                ssl: { rejectUnauthorized: false, servername: "db.example" },
                supportBigNumbers: true,
                bigNumberStrings: true,
                poolSize: 1,
            })
            expect(opened[0]?.queries.slice(0, 2)).toEqual([
                { sql: "SET SESSION TRANSACTION READ ONLY", params: undefined },
                { sql: "SET SESSION MAX_EXECUTION_TIME = ?", params: [15_000] },
            ])
            await expect(session.query("select 1", ["a"])).resolves.toEqual([{ id: "1" }])
            await expect(session.query("select 2")).resolves.toEqual([{ id: "1" }])
            expect(opened[0]?.queries.at(-2)).toEqual({ sql: "select 1", params: ["a"] })
            expect(opened[0]?.queries.at(-1)).toEqual({ sql: "select 2", params: undefined })
            await session.close()
            expect(opened[0]?.destroyed).toBe(true)
        })

        it("answers no rows when the driver answers something that is not rows", async () => {
            const subject = await buildSubject()
            const session = await subject.openMysqlSession(target())
            control.answer = { affectedRows: 1 }

            await expect(session.query("update x")).resolves.toEqual([])
        })

        it("uses no TLS object for a clear-text connection", async () => {
            const subject = await buildSubject()

            await subject.openMysqlSession(target({ ssl: false }))

            expect(opened[0]?.options).toHaveProperty("ssl", undefined)
        })

        it("closes the connection when the read-only setting is refused, even if closing fails", async () => {
            const subject = await buildSubject()
            const refused = new Error("readonly")
            control.setError = refused
            control.destroyError = new Error("destroy")

            await expect(subject.openMysqlSession(target())).rejects.toBe(refused)
            expect(opened[0]?.destroyed).toBe(true)
        })

        it("propagates a refused connect", async () => {
            const subject = await buildSubject()
            const refused = new Error("connect")
            control.connectError = refused

            await expect(subject.openMysqlSession(target())).rejects.toBe(refused)
        })

        it("swallows a failure while closing a live session", async () => {
            const subject = await buildSubject()
            const session = await subject.openMysqlSession(target())
            control.destroyError = new Error("destroy")

            await expect(session.close()).resolves.toBeUndefined()
        })
    })
}

const registerMssql = () => {
    describe("openMssqlSession", () => {
        it("opens one read intent connection and names the server for an encrypted host name", async () => {
            const subject = await buildSubject()

            const session = await subject.openMssqlSession(target({ port: 1433 }))

            expect(opened[0]?.options).toMatchObject({
                type: "mssql",
                host: "203.0.113.8",
                port: 1433,
                connectionTimeout: 10_000,
                requestTimeout: 15_000,
                pool: { max: 1, min: 0 },
                options: {
                    encrypt: true,
                    trustServerCertificate: true,
                    readOnlyIntent: true,
                    serverName: "db.example",
                },
            })
            await expect(session.query("select 1", ["a", "b"])).resolves.toEqual([{ id: "1" }])
            expect(opened[0]?.queries[0]).toEqual({ sql: "select 1", params: ["a", "b"] })
            await session.close()
            expect(opened[0]?.destroyed).toBe(true)
        })

        it("omits the server name for a clear-text connection and for an address", async () => {
            const subject = await buildSubject()

            await subject.openMssqlSession(target({ ssl: false }))
            await subject.openMssqlSession(target({ ssl: { rejectUnauthorized: false } }))

            expect(opened[0]?.options).toMatchObject({ options: { encrypt: false } })
            expect(opened[1]?.options).toMatchObject({ options: { encrypt: true } })
            expect(JSON.stringify(opened[0]?.options)).not.toContain("serverName")
            expect(JSON.stringify(opened[1]?.options)).not.toContain("serverName")
        })

        it("propagates a refused connect", async () => {
            const subject = await buildSubject()
            const refused = new Error("connect")
            control.connectError = refused

            await expect(subject.openMssqlSession(target())).rejects.toBe(refused)
        })
    })
}

describe("customer sessions", () => {
    registerDoubles()
    registerSelectRows()
    registerMysql()
    registerMssql()
})
