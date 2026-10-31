import { Test } from "@nestjs/testing"
import { DataSource } from "typeorm"
import type { PostgresSessionTarget } from "./postgres-session.contracts"
import { openPostgresSession } from "./postgres-session.client"

const SUBJECT = Symbol("postgres-session.client")

type PolicySubject = {
    openPostgresSession: typeof openPostgresSession
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { openPostgresSession },
            },
        ],
    }).compile()
    return moduleRef.get<PolicySubject>(SUBJECT)
}

/** How one fake connection answers: the failures to raise and the queries it saw. */
class DriverControl {
    connectError: Error | undefined = undefined
    destroyError: Error | undefined = undefined
}

interface PostgresOpened {
    readonly options: unknown
    readonly queries: Array<{ sql: string; params: unknown }>
    destroyed: boolean
}

const control = new DriverControl()
const opened: Array<PostgresOpened> = []

const recordOf = (source: DataSource): PostgresOpened => {
    const found = opened.find((entry) => entry.options === source.options)
    if (found !== undefined) return found
    const record: PostgresOpened = { options: source.options, queries: [], destroyed: false }
    opened.push(record)
    return record
}

const registerPostgresDoubles = () => {
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
            return Promise.resolve([{ id: "1" }])
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

const registerPostgresSessions = () => {
    it("opens a read only session with the target's limits and answers rows", async () => {
        const subject = await buildSubject()

        const session = await subject.openPostgresSession(target())

        expect(opened[0]?.options).toMatchObject({
            type: "postgres",
            host: "203.0.113.5",
            port: 5432,
            username: "nivo",
            password: "secret",
            database: "shop",
            ssl: { rejectUnauthorized: false, servername: "db.example" },
            connectTimeoutMS: 10_000,
            extra: {
                options: "-c default_transaction_read_only=on",
                statement_timeout: 15_000,
                query_timeout: 15_000,
                max: 1,
            },
        })
        expect(opened[0]?.queries).toEqual([])
        await expect(session.query("select 1", ["a"])).resolves.toEqual([{ id: "1" }])
        await expect(session.query("select 2")).resolves.toEqual([{ id: "1" }])
        expect(opened[0]?.queries[0]).toEqual({ sql: "select 1", params: ["a"] })
        expect(opened[0]?.queries[1]).toEqual({ sql: "select 2", params: undefined })
        await session.close()
        expect(opened[0]?.destroyed).toBe(true)
    })

    it("opens a clear-text session when the target asks for none", async () => {
        const subject = await buildSubject()

        await subject.openPostgresSession(target({ ssl: false }))

        expect(opened[0]?.options).toHaveProperty("ssl", false)
    })
}

const registerPostgresFailures = () => {
    it("propagates a refused connect", async () => {
        const subject = await buildSubject()
        const refused = new Error("connect")
        control.connectError = refused

        await expect(subject.openPostgresSession(target())).rejects.toBe(refused)
    })

    it("swallows a failure while closing a live session", async () => {
        const subject = await buildSubject()
        const session = await subject.openPostgresSession(target())
        control.destroyError = new Error("destroy")

        await expect(session.close()).resolves.toBeUndefined()
    })
}

const target = (partial: Partial<PostgresSessionTarget> = {}): PostgresSessionTarget => ({
    host: "203.0.113.5",
    port: 5432,
    user: "nivo",
    password: "secret",
    database: "shop",
    ssl: { rejectUnauthorized: false, servername: "db.example" },
    connectMs: 10_000,
    queryMs: 15_000,
    ...partial,
})

describe("postgres session client", () => {
    registerPostgresDoubles()
    registerPostgresSessions()
    registerPostgresFailures()
})
