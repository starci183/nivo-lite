import type { MockEntityManager } from "@starci/jest-preset"

/** The key of the read that loads the row a notification names. */
export const SELECT_EVENT = "realtime:select-event"

/** The key of the read that replays a topic after a frame id. */
export const SELECT_EVENTS_AFTER = "realtime:select-events-after"

/** The key of the read that loads what the followed topics missed. */
export const SELECT_MISSED_EVENTS = "realtime:select-missed-events"

/** The key of the read that notes where a topic stands. */
export const SELECT_TOPIC_HIGHEST_SEQ = "realtime:select-topic-highest-seq"

/** One call chained on a scripted builder. */
interface Chained {
    readonly method: string
    readonly args: ReadonlyArray<unknown>
}

const argOf = (calls: ReadonlyArray<Chained>, method: string, index: number): unknown =>
    calls.findLast((call) => call.method === method)?.args[index]

const parametersOf = (calls: ReadonlyArray<Chained>): Readonly<Record<string, unknown>> => {
    const given = calls.flatMap((call) =>
        (call.method === "where" && call.args[1] !== undefined) || call.method === "setParameters"
            ? [call.args[call.method === "where" ? 1 : 0]]
            : [],
    )
    return Object.assign({}, ...given.filter((value): value is object => typeof value === "object" && value !== null))
}

/** Names the read a chain of builder calls stands for and the arguments it carries, in the order the statement took them. */
const readOf = (calls: ReadonlyArray<Chained>): { readonly key: string; readonly args: ReadonlyArray<unknown> } => {
    const parameters = parametersOf(calls)
    if (
        calls.some(
            (call) => (call.method === "from" || call.method === "innerJoin") && typeof call.args[0] === "function",
        )
    ) {
        return { key: SELECT_EVENTS_AFTER, args: [parameters.topic, parameters.afterId, argOf(calls, "limit", 0)] }
    }
    if (calls.some((call) => call.method === "innerJoin")) {
        return { key: SELECT_MISSED_EVENTS, args: [parameters.topics, parameters.cursors, argOf(calls, "limit", 0)] }
    }
    return { key: SELECT_TOPIC_HIGHEST_SEQ, args: [parameters.topic] }
}

/**
 * Scripts the reads of the Postgres hub on an entity manager whose `query` is already scripted by statement key: a query builder
 * chain is named by its shape and its terminal calls `em.query(key, args)`, and `findOne` of a notified row calls
 * `em.query(SELECT_EVENT, [seq])`. The specs script and assert the reads through `em.query`, as they did when the hub ran raw SQL.
 */
export const scriptRealtimeReads = (em: MockEntityManager): void => {
    em.findOne.mockImplementation((async (_entity: unknown, options: { readonly where: { readonly seq: string } }) => {
        const rows = (await em.query(SELECT_EVENT, [options.where.seq])) as ReadonlyArray<unknown>
        return rows[0] ?? null
    }) as never)
    em.createQueryBuilder.mockImplementation((() => {
        const calls: Array<Chained> = []
        const builder: object = new Proxy(
            {},
            {
                get: (_target, property) => {
                    if (typeof property !== "string") return undefined
                    return (...args: Array<unknown>) => {
                        calls.push({ method: property, args })
                        if (property !== "getRawOne" && property !== "getRawMany") return builder
                        const { key, args: statementArgs } = readOf(calls)
                        return (em.query(key, [...statementArgs]) as Promise<ReadonlyArray<unknown>>).then((rows) =>
                            property === "getRawOne" ? rows[0] : rows,
                        )
                    }
                },
            },
        )
        return builder
    }) as never)
}
