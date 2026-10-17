import { Test } from "@nestjs/testing"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { toDatabaseError } from "./database-errors.policy"
import { DATABASE_COPY } from "./messages/database.messages"

const SUBJECT = Symbol("database-errors.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toDatabaseError } }],
    }).compile()
    return moduleRef.get<typeof import("./database-errors.policy")>(SUBJECT)
}

const registerKnownDatabaseErrors = () => {
    it("returns a data-sources error unchanged", async () => {
        const subject = await buildSubject()

        const own = new DataSourcesError({ code: DataSourcesErrorCode.HostInvalid })

        expect(subject.toDatabaseError(own)).toBe(own)
    })

    it.each<[unknown, string]>([
        [Object.assign(new Error("no"), { code: "28P01" }), DATABASE_COPY.badLogin],
        [driver({ code: "28000" }), DATABASE_COPY.badLogin],
        [driver({ code: "ER_ACCESS_DENIED_ERROR" }), DATABASE_COPY.badLogin],
        [driver({ code: "ELOGIN" }), DATABASE_COPY.badLogin],
        [driver({ errno: 1045 }), DATABASE_COPY.badLogin],
        [driver({ number: 18456 }), DATABASE_COPY.badLogin],
        [new Error("password authentication failed for user"), DATABASE_COPY.badLogin],
        [new Error("Login failed for user 'nivo'"), DATABASE_COPY.badLogin],
        [driver({ code: "3D000" }), DATABASE_COPY.unknownDatabase],
        [driver({ code: "ER_BAD_DB_ERROR" }), DATABASE_COPY.unknownDatabase],
        [driver({ errno: 1049 }), DATABASE_COPY.unknownDatabase],
        [driver({ number: 4060 }), DATABASE_COPY.unknownDatabase],
        [driver({ message: "Unknown database 'shop'" }), DATABASE_COPY.unknownDatabase],
        [driver({ message: "Cannot open database shop" }), DATABASE_COPY.unknownDatabase],
        [driver({ message: "database shop does not exist" }), DATABASE_COPY.unknownDatabase],
        [driver({ code: "57014" }), DATABASE_COPY.queryTooSlow],
        [driver({ code: "ER_QUERY_TIMEOUT" }), DATABASE_COPY.queryTooSlow],
        [driver({ errno: 3024 }), DATABASE_COPY.queryTooSlow],
        [new Error("canceling statement due to statement timeout"), DATABASE_COPY.queryTooSlow],
        [new Error("maximum statement execution time exceeded"), DATABASE_COPY.queryTooSlow],
        [new Error("Query read timeout"), DATABASE_COPY.queryTooSlow],
    ])("rejects a login, database or slow-query failure (%j)", async (error, detail) => {
        const subject = await buildSubject()

        expect(subject.toDatabaseError(error)).toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail },
        })
    })

    it.each<[unknown, string]>([
        [driver({ code: "ETIMEDOUT" }), DATABASE_COPY.connectTimeout],
        [driver({ code: "ETIMEOUT" }), DATABASE_COPY.connectTimeout],
        [new Error("connect timed out"), DATABASE_COPY.connectTimeout],
        [new Error("Connection terminated unexpectedly"), DATABASE_COPY.connectTimeout],
        [driver({ code: "ECONNREFUSED" }), DATABASE_COPY.refused],
        [driver({ code: "ENOTFOUND" }), DATABASE_COPY.unknownHost],
        [driver({ code: "ECONNRESET" }), DATABASE_COPY.reset],
    ])("reports an unreachable server (%j)", async (error, detail) => {
        const subject = await buildSubject()

        const mapped = subject.toDatabaseError(error)

        expect(mapped).toMatchObject({ code: DataSourcesErrorCode.Unavailable, params: { detail } })
        expect(mapped.cause).toBe(error)
    })

    it.each<[unknown, string]>([
        [new Error("The server does not support SSL connections"), DATABASE_COPY.noSsl],
        [driver({ code: "42501" }), DATABASE_COPY.noPermission],
        [driver({ code: "ER_TABLEACCESS_DENIED_ERROR" }), DATABASE_COPY.noPermission],
        [driver({ errno: 1142 }), DATABASE_COPY.noPermission],
        [driver({ number: 229 }), DATABASE_COPY.noPermission],
        [driver({ code: "42P01" }), DATABASE_COPY.tableGone],
        [driver({ code: "ER_NO_SUCH_TABLE" }), DATABASE_COPY.tableGone],
        [driver({ errno: 1146 }), DATABASE_COPY.tableGone],
        [driver({ number: 208 }), DATABASE_COPY.tableGone],
        [driver({ code: "42703" }), DATABASE_COPY.columnGone],
        [driver({ code: "ER_BAD_FIELD_ERROR" }), DATABASE_COPY.columnGone],
        [driver({ errno: 1054 }), DATABASE_COPY.columnGone],
        [driver({ number: 207 }), DATABASE_COPY.columnGone],
    ])("rejects a statement the server answered (%j)", async (error, detail) => {
        const subject = await buildSubject()

        expect(subject.toDatabaseError(error)).toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail },
        })
    })
}

const registerUnknownDatabaseErrors = () => {
    it("shortens an unknown driver message and ignores fields that are not text or numbers", async () => {
        const subject = await buildSubject()

        const noisy = driver({
            code: 12,
            errno: "no",
            number: "no",
            message: `  ${"x".repeat(180)}   ${"y".repeat(40)}  `,
        })

        expect(subject.toDatabaseError(noisy)).toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: DATABASE_COPY.unreadable(` ${"x".repeat(180)} ${"y".repeat(18)}`) },
        })
        expect(subject.toDatabaseError("down")).toMatchObject({
            code: DataSourcesErrorCode.Rejected,
            params: { detail: DATABASE_COPY.unreadable("") },
        })
        expect(subject.toDatabaseError(null).params.detail).toBe(DATABASE_COPY.unreadable(""))
    })
}

interface DriverFields {
    code?: unknown
    errno?: unknown
    number?: unknown
    message?: unknown
}

const driver = (fields: DriverFields): unknown => fields

describe("toDatabaseError", () => {
    registerKnownDatabaseErrors()
    registerUnknownDatabaseErrors()
})
