import type * as SubjectModule from "./database-config.policy"
import { Test } from "@nestjs/testing"
import type { DatabaseTarget } from "@modules/integrations/data-sources"
import type { TableMapping } from "./database-config.contracts"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { DATABASE_WIZARD_COPY as COPY } from "./messages/database.messages"
import {
    checkTarget,
    cleanTables,
    cleanTarget,
    credentialOf,
    parseConfig,
    parseTarget,
    readJson,
    savedTables,
    summaryOf,
    tableKey,
    invalid,
} from "./database-config.policy"

const SUBJECT = Symbol("database-config.policy")
type Subject = Pick<
    typeof SubjectModule,
    | "invalid"
    | "readJson"
    | "tableKey"
    | "parseTarget"
    | "cleanTarget"
    | "checkTarget"
    | "credentialOf"
    | "cleanTables"
    | "savedTables"
    | "parseConfig"
    | "summaryOf"
>

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    invalid,
                    readJson,
                    tableKey,
                    parseTarget,
                    cleanTarget,
                    checkTarget,
                    credentialOf,
                    cleanTables,
                    savedTables,
                    parseConfig,
                    summaryOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const syntaxCause = (text: string): unknown => {
    try {
        JSON.parse(text)
        return null
    } catch (cause) {
        return cause
    }
}

const refused = async (detail: string, run: () => unknown): Promise<void> => {
    await expect(Promise.resolve().then(run)).rejects.toMatchObject({
        code: DataHubErrorCode.Invalid,
        params: { detail },
    })
}

const targetOf = (overrides: Partial<DatabaseTarget> = {}): DatabaseTarget => ({
    engine: "postgres",
    host: "db.example",
    port: 5432,
    database: "app",
    user: "owner",
    password: "secret",
    ssl: true,
    ...overrides,
})

const badEngine = (): DatabaseTarget => Object.assign(targetOf(), { engine: "oracle" })

const columnNames = ["note", ...Array.from({ length: 29 }, (_unused, index) => `c${index}`)]

const rawTables = [
    {
        schema: "public",
        table: "orders",
        entity: "customer",
        idColumn: "id",
        titleColumn: "title",
        updatedColumn: "updated_at",
        columns: ["note", "note", "", "\u0000", 7, ...Array.from({ length: 32 }, (_unused, index) => `c${index}`)],
    },
    {
        schema: "\u0000",
        table: "people",
        entity: "nope",
        idColumn: "id",
        titleColumn: 3,
        updatedColumn: "\u0000",
        columns: "id",
    },
]

const cleanedTables: ReadonlyArray<TableMapping> = [
    {
        schema: "public",
        table: "orders",
        entity: "customer",
        idColumn: "id",
        titleColumn: "title",
        updatedColumn: "updated_at",
        columns: columnNames,
    },
    {
        schema: "",
        table: "people",
        entity: "other",
        idColumn: "id",
        titleColumn: "",
        updatedColumn: "",
        columns: [],
    },
]

describe("readJson", () => {
    it("returns the parsed value", async () => {
        const subject = await buildSubject()

        expect(subject.readJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
        expect(subject.readJson("[1]")).toEqual({ ok: true, value: [1] })
    })

    it("returns the parser error for broken JSON", async () => {
        const subject = await buildSubject()

        expect(subject.readJson("{")).toEqual({ ok: false, cause: syntaxCause("{") })
    })
})

describe("tableKey", () => {
    it("joins the schema and the table", async () => {
        const subject = await buildSubject()

        expect(subject.tableKey({ schema: "public", table: "orders" })).toBe("public.orders")
    })
})

describe("parseTarget", () => {
    it("refuses broken JSON", async () => {
        const subject = await buildSubject()

        await refused(COPY.brokenCredential, () => subject.parseTarget("{"))
    })

    it.each(["null", "[]", "1", '"x"'] as const)("refuses a non-object credential (%s)", async (raw) => {
        const subject = await buildSubject()

        await refused(COPY.brokenCredential, () => subject.parseTarget(raw))
    })

    it.each([
        ["bad engine", { engine: "oracle", host: "db.example", database: "app", user: "owner" }],
        ["blank host", { engine: "postgres", host: "", database: "app", user: "owner" }],
        ["numeric host", { engine: "postgres", host: 4, database: "app", user: "owner" }],
        ["blank database", { engine: "postgres", host: "db.example", database: "", user: "owner" }],
        ["blank user", { engine: "postgres", host: "db.example", database: "app", user: "" }],
        ["missing host", { engine: "postgres", database: "app", user: "owner" }],
    ])("refuses an incomplete credential (%s)", async (_label, fields) => {
        const subject = await buildSubject()

        await refused(COPY.incompleteCredential, () => subject.parseTarget(JSON.stringify(fields)))
    })

    it.each([
        ["postgres", 5432],
        ["mysql", 3306],
        ["mssql", 1433],
    ] as const)("defaults a missing %s port to %s and an omitted ssl flag to true", async (engine, port) => {
        const subject = await buildSubject()

        expect(
            subject.parseTarget(JSON.stringify({ engine, host: "db.example", database: "app", user: "owner" })),
        ).toEqual({
            engine,
            host: "db.example",
            port,
            database: "app",
            user: "owner",
            password: "",
            ssl: true,
        })
    })
})

describe("parseTarget", () => {
    it("falls back when the port is 0 or not a number, and keeps an explicit port", async () => {
        const subject = await buildSubject()

        expect(
            subject.parseTarget(
                JSON.stringify({ engine: "postgres", host: "db.example", database: "app", user: "owner", port: 0 }),
            ),
        ).toEqual({
            engine: "postgres",
            host: "db.example",
            port: 5432,
            database: "app",
            user: "owner",
            password: "",
            ssl: true,
        })
        expect(
            subject.parseTarget(
                JSON.stringify({
                    engine: "mysql",
                    host: "db.example",
                    database: "app",
                    user: "owner",
                    port: "nope",
                }),
            ),
        ).toEqual({
            engine: "mysql",
            host: "db.example",
            port: 3306,
            database: "app",
            user: "owner",
            password: "",
            ssl: true,
        })
        expect(
            subject.parseTarget(
                JSON.stringify({
                    engine: "mssql",
                    host: "db.example",
                    database: "app",
                    user: "owner",
                    password: " secret ",
                    port: 15432,
                    ssl: false,
                }),
            ),
        ).toEqual({
            engine: "mssql",
            host: "db.example",
            port: 15432,
            database: "app",
            user: "owner",
            password: " secret ",
            ssl: false,
        })
        expect(
            subject.parseTarget(
                JSON.stringify({
                    engine: "postgres",
                    host: "db.example",
                    database: "app",
                    user: "owner",
                    password: "secret",
                    port: 5432,
                    ssl: true,
                }),
            ),
        ).toEqual(targetOf())
    })
})

describe("cleanTarget", () => {
    it("trims the host, database and user, and leaves the password as typed", async () => {
        const subject = await buildSubject()

        expect(
            subject.cleanTarget(
                targetOf({
                    engine: "mysql",
                    host: " db.example ",
                    port: 3306,
                    database: " app ",
                    user: " owner ",
                    password: " secret ",
                    ssl: false,
                }),
            ),
        ).toEqual({
            engine: "mysql",
            host: "db.example",
            port: 3306,
            database: "app",
            user: "owner",
            password: " secret ",
            ssl: false,
        })
        expect(subject.cleanTarget(targetOf({ ssl: true })).ssl).toBe(true)
    })
})

describe("checkTarget", () => {
    it("names the first thing wrong with the target", async () => {
        const subject = await buildSubject()

        expect(subject.checkTarget(badEngine())).toBe(COPY.badEngine)
        expect(subject.checkTarget(targetOf({ host: "" }))).toBe(COPY.needHost)
        expect(subject.checkTarget(targetOf({ host: "h".repeat(254) }))).toBe(COPY.needHost)
        expect(subject.checkTarget(targetOf({ port: 0 }))).toBe(COPY.badPort)
        expect(subject.checkTarget(targetOf({ port: 65_536 }))).toBe(COPY.badPort)
        expect(subject.checkTarget(targetOf({ port: 1.5 }))).toBe(COPY.badPort)
        expect(subject.checkTarget(targetOf({ database: "" }))).toBe(COPY.needDatabase)
        expect(subject.checkTarget(targetOf({ database: "d".repeat(129) }))).toBe(COPY.needDatabase)
        expect(subject.checkTarget(targetOf({ user: "" }))).toBe(COPY.needUser)
        expect(subject.checkTarget(targetOf({ user: "u".repeat(129) }))).toBe(COPY.needUser)
        expect(subject.checkTarget(targetOf({ password: "p".repeat(513) }))).toBe(COPY.passwordTooLong)
    })

    it("accepts a complete target", async () => {
        const subject = await buildSubject()

        expect(subject.checkTarget(targetOf())).toBeNull()
        expect(subject.checkTarget(targetOf({ host: "h".repeat(253) }))).toBeNull()
    })
})

describe("credentialOf", () => {
    it("stores the target fields in the legacy order", async () => {
        const subject = await buildSubject()

        const target = targetOf({ password: " secret ", port: 15432, ssl: false })

        expect(subject.credentialOf(target)).toBe(
            JSON.stringify({
                engine: "postgres",
                host: "db.example",
                port: 15432,
                database: "app",
                user: "owner",
                password: " secret ",
                ssl: false,
            }),
        )
    })
})

describe("cleanTables", () => {
    it("refuses a missing, empty or oversized list", async () => {
        const subject = await buildSubject()

        await refused(COPY.needTable, () => subject.cleanTables("nope"))
        await refused(COPY.needTable, () => subject.cleanTables([]))
        await refused(COPY.tooManyTables, () =>
            subject.cleanTables(
                Array.from({ length: 101 }, (_unused, index) => ({ table: `t${index}`, idColumn: "id" })),
            ),
        )
    })

    it("refuses a row that has no usable table or id column", async () => {
        const subject = await buildSubject()

        await refused(COPY.needIdColumn(COPY.unnamedTable), () => subject.cleanTables([null]))
        await refused(COPY.needIdColumn(COPY.unnamedTable), () => subject.cleanTables([{ idColumn: "id" }]))
        await refused(COPY.needIdColumn(COPY.unnamedTable), () => subject.cleanTables([{ table: "", idColumn: "id" }]))
        await refused(COPY.needIdColumn(COPY.unnamedTable), () =>
            subject.cleanTables([{ table: "a\u0000b", idColumn: "id" }]),
        )
        await refused(COPY.needIdColumn("orders"), () => subject.cleanTables([{ table: "orders" }]))
        await refused(COPY.needIdColumn("orders"), () =>
            subject.cleanTables([{ table: "orders", idColumn: "id\u0000" }]),
        )
    })

    it("refuses the same schema and table twice", async () => {
        const subject = await buildSubject()

        await refused(COPY.pickedTwice("public.orders"), () =>
            subject.cleanTables([
                { schema: "public", table: "orders", idColumn: "id" },
                { schema: "sales", table: "orders", idColumn: "id" },
                { schema: "public", table: "orders", idColumn: "id" },
            ]),
        )
    })

    it("keeps a known entity, drops blank columns and clips the rest", async () => {
        const subject = await buildSubject()

        expect(subject.cleanTables(rawTables)).toEqual({ tables: cleanedTables })
        expect(cleanedTables[0]?.columns).toHaveLength(30)
    })
})

describe("savedTables", () => {
    it("is empty when the json is missing, broken or has no tables", async () => {
        const subject = await buildSubject()

        expect(subject.savedTables(undefined)).toEqual([])
        expect(subject.savedTables("{")).toEqual([])
        expect(subject.savedTables("[]")).toEqual([])
        expect(subject.savedTables("null")).toEqual([])
        expect(subject.savedTables("{}")).toEqual([])
        expect(subject.savedTables(JSON.stringify({ tables: [] }))).toEqual([])
    })

    it("reads a valid table list", async () => {
        const subject = await buildSubject()

        expect(subject.savedTables(JSON.stringify({ tables: rawTables }))).toEqual(cleanedTables)
    })
})

describe("parseConfig", () => {
    it("refuses a saved config that yields no tables", async () => {
        const subject = await buildSubject()

        await refused(COPY.brokenConfig, () => subject.parseConfig(undefined))
        await refused(COPY.brokenConfig, () => subject.parseConfig("{"))
        await refused(COPY.brokenConfig, () => subject.parseConfig("{}"))
    })

    it("returns the saved tables", async () => {
        const subject = await buildSubject()

        expect(subject.parseConfig(JSON.stringify({ tables: rawTables }))).toEqual({ tables: cleanedTables })
    })
})

describe("summaryOf", () => {
    it("uses the product name of each engine", async () => {
        const subject = await buildSubject()

        expect(subject.summaryOf("postgres", 2)).toBe(COPY.summary("PostgreSQL", 2))
        expect(subject.summaryOf("mysql", 0)).toBe(COPY.summary("MySQL", 0))
        expect(subject.summaryOf("mssql", 1)).toBe(COPY.summary("SQL Server", 1))
    })
})
