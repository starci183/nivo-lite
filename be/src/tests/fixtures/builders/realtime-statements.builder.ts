import { queueQueryBuilders } from "@starci/jest-preset"
import type { FakeQueryBuilder, MockEntityManager, QueryBuilderCall } from "@starci/jest-preset"

/** The key of the read that loads the row a notification names. */
export const SELECT_EVENT = "realtime:select-event"

/** The key of the read that replays a topic after a frame id. */
export const SELECT_EVENTS_AFTER = "realtime:select-events-after"

/** The key of the read that loads what the followed topics missed. */
export const SELECT_MISSED_EVENTS = "realtime:select-missed-events"

/** The key of the read that notes where a topic stands. */
export const SELECT_TOPIC_HIGHEST_SEQ = "realtime:select-topic-highest-seq"

/** How many query builders a scripted manager hands out; a spec that asks for more is asking for a runaway loop. */
const BUILDERS_QUEUED = 256

/** A statement key with the arguments its chain of builder calls carried. */
interface ReadOf {
    readonly key: string
    readonly args: ReadonlyArray<unknown>
}

const argOf = (calls: ReadonlyArray<QueryBuilderCall>, method: string, index: number): unknown =>
    calls.findLast((call) => call.method === method)?.args[index]

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null

const parametersOf = (calls: ReadonlyArray<QueryBuilderCall>): Readonly<Record<string, unknown>> => {
    const given = calls.flatMap((call) =>
        (call.method === "where" && call.args[1] !== undefined) || call.method === "setParameters"
            ? [call.args[call.method === "where" ? 1 : 0]]
            : [],
    )
    return given.filter(isObject).reduce<Record<string, unknown>>((all, item) => ({ ...all, ...item }), {})
}

/** Names the read a chain of builder calls stands for and the arguments it carries, in the order the statement took them. */
const readOf = (calls: ReadonlyArray<QueryBuilderCall>): ReadOf => {
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

/** The sequence number a `findOne` of a notified row asks for. */
const seqOf = (options: unknown): unknown => {
    if (!isObject(options)) return undefined
    const where: unknown = Reflect.get(options, "where")
    return isObject(where) ? Reflect.get(where, "seq") : undefined
}

/** Answers the read a statement key and its arguments stand for. */
export type ReadStatement = (key: string, args: ReadonlyArray<unknown>) => Promise<ReadonlyArray<unknown>>

/**
 * Scripts the reads of the Postgres hub on an entity manager: a query builder chain is named by its shape and its terminal asks
 * `read(key, args)`, and `findOne` of a notified row asks `read(SELECT_EVENT, [seq])`. The specs script and assert the reads through
 * `read`, as they did when the hub ran raw SQL. Answers the builders handed out, so a spec can read the calls each one took.
 */
export const scriptRealtimeReads = (em: MockEntityManager, read: ReadStatement): ReadonlyArray<FakeQueryBuilder> => {
    em.findOne.mockImplementation(async (_entity, options) => {
        const rows = await read(SELECT_EVENT, [seqOf(options)])
        return rows[0] ?? null
    })
    const handedOut: Array<FakeQueryBuilder> = []
    const rowsOf = (index: number): Promise<ReadonlyArray<unknown>> => {
        const { key, args } = readOf(handedOut[index]?.calls ?? [])
        return read(key, args)
    }
    const answers = Array.from({ length: BUILDERS_QUEUED }, (_, index) => ({
        getRawOne: async () => (await rowsOf(index))[0],
        getRawMany: () => rowsOf(index),
    }))
    handedOut.push(...queueQueryBuilders(em, answers))
    return handedOut
}
