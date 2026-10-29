import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import * as platformDatabase from "@modules/platform/database"
import type { CustomerSession, PostgresSession } from "@modules/platform/database"
import type { DatabaseTarget } from "./database-session.contracts"
import { DATABASE_CONNECT_MS, DATABASE_QUERY_MS, openMssql, openMysql, openPostgres } from "./database-drivers.client"

const SUBJECT = Symbol("database-drivers.client")

type PolicySubject = {
    openPostgres: typeof openPostgres
    openMysql: typeof openMysql
    openMssql: typeof openMssql
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    openPostgres,
                    openMysql,
                    openMssql,
                },
            },
        ],
    }).compile()
    return moduleRef.get<PolicySubject>(SUBJECT)
}

const registerDatabaseDrivers = () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe("openPostgres", () => {
        it("opens the platform session with the resolved target and answers its rows", async () => {
            const subject = await buildSubject()
            const session = postgresSessionOf()
            const open = jest.spyOn(platformDatabase, "openPostgresSession").mockResolvedValue(session)

            const opened = await subject.openPostgres(target(), "203.0.113.5")

            expect(open).toHaveBeenCalledWith({
                host: "203.0.113.5",
                port: 5432,
                user: "nivo",
                password: "secret",
                database: "shop",
                ssl: { rejectUnauthorized: false, servername: "db.example" },
                connectMs: DATABASE_CONNECT_MS,
                queryMs: DATABASE_QUERY_MS,
            })
            await expect(platformDatabase.selectRows(opened, "select 1", ["a"])).resolves.toEqual([{ id: "1" }])
            await expect(platformDatabase.selectRows(opened, "select 2")).resolves.toEqual([{ id: "1" }])
            expect(session.query).toHaveBeenNthCalledWith(1, "select 1", ["a"])
            expect(session.query).toHaveBeenNthCalledWith(2, "select 2")
            await opened.close()
            expect(session.close).toHaveBeenCalledTimes(1)
        })

        it("sends no server name for an address and no TLS options for a clear-text target", async () => {
            const subject = await buildSubject()
            const open = jest.spyOn(platformDatabase, "openPostgresSession").mockResolvedValue(postgresSessionOf())

            await subject.openPostgres(target({ host: "203.0.113.5", ssl: true }), "203.0.113.5")
            await subject.openPostgres(target({ ssl: false }), "203.0.113.5")

            expect(open).toHaveBeenNthCalledWith(1, expect.objectContaining({ ssl: { rejectUnauthorized: false } }))
            expect(open).toHaveBeenNthCalledWith(2, expect.objectContaining({ ssl: false }))
        })

        it("propagates a session open refusal", async () => {
            const subject = await buildSubject()
            const refused = new Error("readonly")
            jest.spyOn(platformDatabase, "openPostgresSession").mockRejectedValue(refused)

            await expect(subject.openPostgres(target(), "203.0.113.5")).rejects.toBe(refused)
        })
    })
}

const registerOpenCustomer = () => {
    describe("openMysql and openMssql", () => {
        it.each([
            ["mysql", "openMysqlSession"],
            ["mssql", "openMssqlSession"],
        ] as const)(
            "opens the platform %s session with the resolved target and answers its rows",
            async (engine, opener) => {
                const subject = await buildSubject()
                const session = mock<CustomerSession>()
                session.query.mockResolvedValue([{ ...ROW }])
                session.close.mockResolvedValue(undefined)
                const open = jest.spyOn(platformDatabase, opener).mockResolvedValue(session)

                const opened = await (engine === "mysql" ? subject.openMysql : subject.openMssql)(
                    target({ engine, port: 3306 }),
                    "203.0.113.8",
                )

                expect(open).toHaveBeenCalledWith({
                    host: "203.0.113.8",
                    port: 3306,
                    user: "nivo",
                    password: "secret",
                    database: "shop",
                    ssl: { rejectUnauthorized: false, servername: "db.example" },
                    connectMs: DATABASE_CONNECT_MS,
                    queryMs: DATABASE_QUERY_MS,
                })
                expect(opened.engine).toBe(engine)
                await expect(platformDatabase.selectRows(opened, "select 1", ["a"])).resolves.toEqual([{ id: "1" }])
                expect(session.query).toHaveBeenCalledWith("select 1", ["a"])
                await opened.close()
                expect(session.close).toHaveBeenCalledTimes(1)
            },
        )

        it("opens a clear-text session for a target without TLS", async () => {
            const subject = await buildSubject()
            const open = jest.spyOn(platformDatabase, "openMysqlSession").mockResolvedValue(mock<CustomerSession>())

            await subject.openMysql(target({ engine: "mysql", ssl: false }), "203.0.113.8")

            expect(open).toHaveBeenCalledWith(expect.objectContaining({ ssl: false }))
        })
    })
}

const ROW = { id: "1" }

/** A platform postgres session over the control of the running test. */
const postgresSessionOf = (): MockOf<PostgresSession> => {
    const session = mock<PostgresSession>()
    session.query.mockResolvedValue([{ ...ROW }])
    session.close.mockResolvedValue(undefined)
    return session
}

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
    registerDatabaseDrivers()
    registerOpenCustomer()
})
