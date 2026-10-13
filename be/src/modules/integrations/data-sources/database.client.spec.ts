import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PUBLIC_HOST } from "./data-sources.decorators"
import type { DatabaseSelection, DatabaseTarget } from "./database-session.contracts"
import { DatabaseClient } from "./database.client"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import type { PublicHostClient } from "./public-host.client"

class QueryControl {
    rows: Array<Record<string, unknown>> = []
    fail: Error | undefined = undefined
    connectFail: Error | undefined = undefined
    sql: Array<string> = []
    reset(): void {
        this.rows = []
        this.fail = undefined
        this.connectFail = undefined
        this.sql = []
    }
}

const mockQuery = new QueryControl()
const mockOpened: Array<string> = []

jest.mock("pg", () => ({
    Client: class {
        on(): void {}
        connect(): Promise<void> {
            return mockQuery.connectFail === undefined ? Promise.resolve() : Promise.reject(mockQuery.connectFail)
        }
        query(sql: string): Promise<{ rows: Array<Record<string, unknown>> }> {
            mockQuery.sql.push(sql)
            if (sql.startsWith("SET SESSION")) return Promise.resolve({ rows: [] })
            return mockQuery.fail === undefined
                ? Promise.resolve({ rows: mockQuery.rows })
                : Promise.reject(mockQuery.fail)
        }
        end(): Promise<void> {
            return Promise.resolve()
        }
    },
}))

jest.mock("mysql2/promise", () => ({
    createConnection: () => {
        mockOpened.push("mysql")
        const connection = {
            on(): void {},
            query: () => Promise.resolve([mockQuery.rows]),
            destroy(): void {},
            end: () => Promise.resolve(),
        }
        return Promise.resolve(connection)
    },
}))

jest.mock("mssql", () => ({
    NVarChar: "nvarchar",
    ConnectionPool: class {
        on(): void {}
        connect(): Promise<void> {
            mockOpened.push("mssql")
            return Promise.resolve()
        }
        request() {
            return { input: () => undefined, query: () => Promise.resolve({ recordset: mockQuery.rows }) }
        }
        close(): Promise<void> {
            return Promise.resolve()
        }
    },
}))

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
    beforeEach(() => {
        mockQuery.reset()
        mockOpened.length = 0
    })

    it("lists the tables the postgres user can see", async () => {
        const { client, publicHost } = await build()
        mockQuery.rows = [{ s: "public", t: "orders", c: "id", d: "int" }]

        await expect(client.listTables(target("postgres"))).resolves.toEqual([
            { schema: "public", name: "orders", columns: [{ name: "id", type: "int" }] },
        ])
        expect(publicHost.resolve).toHaveBeenCalledWith("db.example")
    })

    it("previews the first rows of a mysql table", async () => {
        const { client } = await build()
        mockQuery.rows = [{ id: "1", title: "Ada", note: "hi" }]

        await expect(client.preview(target("mysql"), selection)).resolves.toEqual({
            columns: ["id", "title", "updated_at", "note"],
            rows: [["1", "Ada", "", "hi"]],
        })
        expect(mockOpened).toEqual(["mysql"])
    })

    it("reads mssql rows, skips a row with no id, and returns the cursor", async () => {
        const { client } = await build()
        mockQuery.rows = [
            { id: null, title: "skip" },
            { id: "2", title: "Keep", note: "n", __nivo_cursor: "2026-01-02" },
        ]

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
        expect(mockOpened).toEqual(["mssql"])
    })

    it("maps a refused connection and a failed query, and still closes the session", async () => {
        const { client } = await build()
        const refused = Object.assign(new Error("no"), { code: "ECONNREFUSED" })
        mockQuery.connectFail = refused

        await expect(client.listTables(target("postgres"))).rejects.toMatchObject({
            code: DataSourcesErrorCode.Unavailable,
            cause: refused,
        })

        mockQuery.connectFail = undefined
        const queryFailed = new Error("syntax")
        mockQuery.fail = queryFailed
        await expect(client.listTables(target("postgres"))).rejects.toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            cause: queryFailed,
        })
    })
})
