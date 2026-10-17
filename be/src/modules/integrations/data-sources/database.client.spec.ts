import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import { PUBLIC_HOST } from "./data-sources.decorators"
import * as drivers from "./database-drivers.client"
import type {
    DatabaseEngine,
    DatabaseRow,
    DatabaseSelection,
    DatabaseSession,
    DatabaseTarget,
} from "./database-session.contracts"
import { DatabaseClient } from "./database.client"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import type { PublicHostClient } from "./public-host.client"

const registerDatabaseClient = () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("lists the tables the postgres user can see and closes the session", async () => {
        const { client, publicHost } = await build()
        const session = sessionOf("postgres", [{ s: "public", t: "orders", c: "id", d: "int" }])
        const open = jest.spyOn(drivers, "openPostgres").mockResolvedValue(session)

        await expect(client.listTables(target("postgres"))).resolves.toEqual([
            { schema: "public", name: "orders", columns: [{ name: "id", type: "int" }] },
        ])
        expect(publicHost.resolve).toHaveBeenCalledWith("db.example")
        expect(open).toHaveBeenCalledWith(target("postgres"), "203.0.113.5")
        expect(session.close).toHaveBeenCalledTimes(1)
    })

    it("previews the first rows of a mysql table", async () => {
        const { client } = await build()
        const open = jest
            .spyOn(drivers, "openMysql")
            .mockResolvedValue(sessionOf("mysql", [{ id: "1", title: "Ada", note: "hi" }]))

        await expect(client.preview(target("mysql"), selection)).resolves.toEqual({
            columns: ["id", "title", "updated_at", "note"],
            rows: [["1", "Ada", "", "hi"]],
        })
        expect(open).toHaveBeenCalledWith(target("mysql"), "203.0.113.5")
    })

    it("reads mssql rows, skips a row with no id, and returns the cursor", async () => {
        const { client } = await build()
        const open = jest.spyOn(drivers, "openMssql").mockResolvedValue(
            sessionOf("mssql", [
                { id: null, title: "skip" },
                { id: "2", title: "Keep", note: "n", __nivo_cursor: "2026-01-02" },
            ]),
        )

        await expect(
            client.read(target("mssql"), (session) =>
                session.readTable(selection, { limit: 10, cursor: "2026-01-01" }),
            ),
        ).resolves.toEqual({
            records: [
                {
                    externalId: "2",
                    title: "Keep",
                    occurredAt: null,
                    data: { note: "n" },
                },
            ],
            cursor: "2026-01-02",
        })
        expect(open).toHaveBeenCalledWith(target("mssql"), "203.0.113.5")
    })
}

const registerDatabaseFailures = () => {
    it("maps a refused connection and a failed query, and still closes the session", async () => {
        const { client } = await build()
        const refused = Object.assign(new Error("no"), { code: "ECONNREFUSED" })
        const session = sessionOf("postgres")
        const queryFailed = new Error("syntax")
        session.query.mockRejectedValue(queryFailed)
        jest.spyOn(drivers, "openPostgres").mockRejectedValueOnce(refused).mockResolvedValueOnce(session)

        await expect(client.listTables(target("postgres"))).rejects.toMatchObject({
            code: DataSourcesErrorCode.Unavailable,
            cause: refused,
        })
        await expect(client.listTables(target("postgres"))).rejects.toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            cause: queryFailed,
        })
        expect(session.close).toHaveBeenCalledTimes(1)
    })

    it("propagates a session cleanup failure after a successful read", async () => {
        const { client } = await build()
        const session = sessionOf("postgres")
        const cause = new Error("cleanup failed")
        session.close.mockRejectedValue(cause)
        const open = jest.spyOn(drivers, "openPostgres").mockResolvedValue(session)

        await expect(client.read(target("postgres"), () => Promise.resolve("done"))).rejects.toBe(cause)
        expect(open).toHaveBeenCalledWith(target("postgres"), "203.0.113.5")
        expect(session.close).toHaveBeenCalledTimes(1)
        expect(session.query).not.toHaveBeenCalled()
    })

    it("propagates a public-host resolution failure before opening a database session", async () => {
        const { client, publicHost } = await build()
        const failure = new Error("host unavailable")
        publicHost.resolve.mockRejectedValue(failure)
        const postgres = jest.spyOn(drivers, "openPostgres")
        const mysql = jest.spyOn(drivers, "openMysql")
        const mssql = jest.spyOn(drivers, "openMssql")

        await expect(client.listTables(target("postgres"))).rejects.toBe(failure)
        expect(publicHost.resolve).toHaveBeenCalledWith("db.example")
        expect(postgres).not.toHaveBeenCalled()
        expect(mysql).not.toHaveBeenCalled()
        expect(mssql).not.toHaveBeenCalled()
    })

    it("maps a table read failure and closes the session", async () => {
        const { client } = await build()
        const session = sessionOf("postgres")
        const failure = new Error("query denied")
        session.query.mockRejectedValue(failure)
        jest.spyOn(drivers, "openPostgres").mockResolvedValue(session)

        await expect(
            client.read(target("postgres"), (reader) => reader.readTable(selection, { limit: 10 })),
        ).rejects.toMatchObject({ code: DataSourcesErrorCode.Rejected, cause: failure })
        expect(session.query).toHaveBeenCalledWith(
            'SELECT "id", "title", "updated_at", "note", ("updated_at")::text AS "__nivo_cursor" ' +
                'FROM "public"."orders" ORDER BY "updated_at" ASC LIMIT 10',
            [],
        )
        expect(session.close).toHaveBeenCalledTimes(1)
    })
}

const registerDatabaseCleanup = () => {
    it("propagates a cleanup failure when the read callback also rejects", async () => {
        const { client } = await build()
        const session = sessionOf("postgres")
        const readFailure = new Error("read failed")
        const cleanupFailure = new Error("cleanup failed")
        session.close.mockRejectedValue(cleanupFailure)
        jest.spyOn(drivers, "openPostgres").mockResolvedValue(session)

        await expect(client.read(target("postgres"), () => Promise.reject(readFailure))).rejects.toBe(cleanupFailure)
        expect(session.close).toHaveBeenCalledTimes(1)
        expect(session.query).not.toHaveBeenCalled()
    })
}

const sessionOf = (engine: DatabaseEngine, rows: ReadonlyArray<DatabaseRow> = []): MockOf<DatabaseSession> => {
    const session = mock<DatabaseSession>({ engine })
    session.query.mockResolvedValue(rows)
    session.close.mockResolvedValue(undefined)
    return session
}

const target = (engine: DatabaseTarget["engine"]): DatabaseTarget => ({
    engine,
    host: "db.example",
    port: 5432,
    database: "shop",
    user: "nivo",
    password: "secret",
    ssl: false,
})

const selection: DatabaseSelection = {
    schema: "public",
    table: "orders",
    idColumn: "id",
    titleColumn: "title",
    updatedColumn: "updated_at",
    columns: ["note"],
}

const build = async () => {
    const publicHost = mock<PublicHostClient>()
    publicHost.resolve.mockResolvedValue({ address: "203.0.113.5", family: 4 })
    const moduleRef = await Test.createTestingModule({
        providers: [DatabaseClient, { provide: PUBLIC_HOST, useValue: publicHost }],
    }).compile()
    return { client: moduleRef.get(DatabaseClient), publicHost }
}

describe("DatabaseClient", () => {
    registerDatabaseClient()
    registerDatabaseFailures()
    registerDatabaseCleanup()
})
