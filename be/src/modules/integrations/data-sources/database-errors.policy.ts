import { isPlainObject } from "./database-values.policy"
import { DataSourcesError, DataSourcesErrorCode } from "./errors/data-sources.error"
import { DATABASE_COPY } from "./messages/database.messages"

interface DriverFacts {
    readonly code: string
    readonly errno: number
    readonly number: number
    readonly message: string
}

const factsOf = (error: unknown): DriverFacts => {
    const source = isPlainObject(error) ? error : {}
    const text = (value: unknown): string => (typeof value === "string" ? value : "")
    const numeric = (value: unknown): number => (typeof value === "number" ? value : 0)
    return {
        code: text(source.code),
        errno: numeric(source.errno),
        number: numeric(source.number),
        message: error instanceof Error ? error.message : text(source.message),
    }
}

interface Rule {
    readonly unavailable: boolean
    readonly text: string
    readonly test: (facts: DriverFacts) => boolean
}

const RULES: ReadonlyArray<Rule> = [
    {
        unavailable: false,
        text: DATABASE_COPY.badLogin,
        test: (f) =>
            ["28P01", "28000", "ER_ACCESS_DENIED_ERROR", "ELOGIN"].includes(f.code) ||
            f.errno === 1045 ||
            f.number === 18456 ||
            /password authentication failed|Login failed/iu.test(f.message),
    },
    {
        unavailable: false,
        text: DATABASE_COPY.unknownDatabase,
        test: (f) =>
            ["3D000", "ER_BAD_DB_ERROR"].includes(f.code) ||
            f.errno === 1049 ||
            f.number === 4060 ||
            /Unknown database|Cannot open database|database .* does not exist/iu.test(f.message),
    },
    {
        unavailable: false,
        text: DATABASE_COPY.queryTooSlow,
        test: (f) =>
            ["57014", "ER_QUERY_TIMEOUT"].includes(f.code) ||
            f.errno === 3024 ||
            /statement timeout|canceling statement|maximum statement execution time|Query read timeout/iu.test(
                f.message,
            ),
    },
    {
        unavailable: true,
        text: DATABASE_COPY.connectTimeout,
        test: (f) =>
            ["ETIMEDOUT", "ETIMEOUT"].includes(f.code) || /timeout|timed out|Connection terminated/iu.test(f.message),
    },
    {
        unavailable: true,
        text: DATABASE_COPY.refused,
        test: (f) => f.code === "ECONNREFUSED",
    },
    { unavailable: true, text: DATABASE_COPY.unknownHost, test: (f) => f.code === "ENOTFOUND" },
    { unavailable: true, text: DATABASE_COPY.reset, test: (f) => f.code === "ECONNRESET" },
    {
        unavailable: false,
        text: DATABASE_COPY.noSsl,
        test: (f) => /does not support SSL|SSL/iu.test(f.message),
    },
    {
        unavailable: false,
        text: DATABASE_COPY.noPermission,
        test: (f) =>
            f.code === "42501" || f.code === "ER_TABLEACCESS_DENIED_ERROR" || f.errno === 1142 || f.number === 229,
    },
    {
        unavailable: false,
        text: DATABASE_COPY.tableGone,
        test: (f) => f.code === "42P01" || f.code === "ER_NO_SUCH_TABLE" || f.errno === 1146 || f.number === 208,
    },
    {
        unavailable: false,
        text: DATABASE_COPY.columnGone,
        test: (f) => f.code === "42703" || f.code === "ER_BAD_FIELD_ERROR" || f.errno === 1054 || f.number === 207,
    },
]

/** A driver failure as a DataSourcesError with a plain Vietnamese reason; our own errors pass through. */
export const toDatabaseError = (error: unknown): DataSourcesError => {
    if (error instanceof DataSourcesError) return error
    const facts = factsOf(error)
    const rule = RULES.find((candidate) => candidate.test(facts))
    const detail = rule?.text ?? DATABASE_COPY.unreadable(facts.message.replace(/\s+/gu, " ").slice(0, 200))
    return new DataSourcesError({
        code: rule?.unavailable === true ? DataSourcesErrorCode.Unavailable : DataSourcesErrorCode.Rejected,
        params: { detail },
        cause: error,
    })
}
