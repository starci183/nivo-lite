import { getMetadataArgsStorage } from "typeorm"
import type { ObjectLiteral, SelectQueryBuilder } from "typeorm"
import type { QueryBuilderCall } from "./entity-query-builder.builder"

/** One query a spec saw: the table it read and every chained call. */
export interface TableQuery {
    /** The table named in `from`, as written (`public.agents`). */
    readonly table: string
    /** Every chained call, in order. */
    readonly calls: ReadonlyArray<QueryBuilderCall>
    /** The recorded calls of one builder method. */
    callsOf(method: string): ReadonlyArray<ReadonlyArray<unknown>>
}

/** The mocked `createQueryBuilder` of an entity manager, which can answer every call. */
export interface TableQueryFactory {
    /** Answers every `createQueryBuilder` call with the builder this function makes. */
    mockImplementation(factory: (entity?: unknown) => SelectQueryBuilder<ObjectLiteral>): unknown
}

/** The part of a mocked entity manager that hands out query builders, any number of times. */
export interface TableQuerySource {
    /** The mocked `createQueryBuilder`. */
    readonly createQueryBuilder: TableQueryFactory
}

/** The fake is a stand-in for a typeorm builder; this is the one place that says so to the type system. */
const asQueryBuilder: (value: object) => asserts value is SelectQueryBuilder<ObjectLiteral> = (_value) => undefined

/** The table an entity class maps, as `schema.name`; empty for something that is no entity. */
const tableOfEntity = (entity: unknown): string => {
    const mapped = getMetadataArgsStorage().tables.find((table) => table.target === entity)
    return mapped === undefined ? "" : `${mapped.schema ?? "public"}.${String(mapped.name)}`
}

/** What `answerByTable` hands back to a spec. */
export interface TableAnswers {
    /** Every query seen, in call order. */
    readonly queries: Array<TableQuery>
    /** The queries that read one table. */
    queriesOf(table: string): ReadonlyArray<TableQuery>
}

/** The rows one read answers; a rejected promise makes that read fail. */
export type RowsAnswer = ReadonlyArray<unknown> | Promise<ReadonlyArray<unknown>>

/** The rows a table answers: a list, or a function of the query asking when one table serves several reads. */
export type TableRows = ReadonlyArray<unknown> | ((query: TableQuery) => RowsAnswer)

/**
 * Answers every `createQueryBuilder` of the manager with a chainable fake that reads the entity it was made for (or `from(table, alias)`) and answers its
 * `getRawMany` / `getRawOne` / `execute` with the rows named for that table; a spec reads back what each query asked.
 */
export const answerByTable = (manager: TableQuerySource, tables: Readonly<Record<string, TableRows>>): TableAnswers => {
    const queries: Array<TableQuery> = []
    manager.createQueryBuilder.mockImplementation((entity?: unknown) => {
        const calls: Array<QueryBuilderCall> = []
        let table = tableOfEntity(entity)
        const rowsOf = (): RowsAnswer => {
            const rows = tables[table] ?? tables[""] ?? []
            return typeof rows === "function" ? rows(query) : rows
        }
        const builder: object = new Proxy(
            {},
            {
                get: (_target, property) => {
                    if (typeof property !== "string") return undefined
                    return (...args: Array<unknown>) => {
                        calls.push({ method: property, args })
                        if (property === "from" && typeof args[0] === "string") table = args[0]
                        if (property === "getRawMany") return Promise.resolve(rowsOf())
                        if (property === "getRawOne") return Promise.resolve(rowsOf()).then((rows) => rows[0])
                        if (property === "execute") return Promise.resolve(rowsOf()).then((raw) => ({ raw }))
                        return builder
                    }
                },
            },
        )
        const query: TableQuery = {
            get table() {
                return table
            },
            calls,
            callsOf: (method) => calls.filter((call) => call.method === method).map((call) => call.args),
        }
        queries.push(query)
        asQueryBuilder(builder)
        return builder
    })
    return { queries, queriesOf: (table) => queries.filter((query) => query.table === table) }
}
