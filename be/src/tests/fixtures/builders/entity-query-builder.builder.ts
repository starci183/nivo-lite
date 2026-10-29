import type { ObjectLiteral, SelectQueryBuilder } from "typeorm"

/** One chained call recorded on a fake query builder. */
export interface QueryBuilderCall {
    /** The builder method that was called. */
    readonly method: string
    /** The arguments it was called with. */
    readonly args: ReadonlyArray<unknown>
}

/** What the terminal methods of a fake query builder answer. */
export interface QueryBuilderAnswers {
    /** The answer of `execute()`. */
    readonly execute?: unknown
    /** The answer of `getMany()`. */
    readonly getMany?: ReadonlyArray<unknown>
    /** The answer of `getOne()`. */
    readonly getOne?: unknown
    /** The answer of `getRawMany()`. */
    readonly getRawMany?: ReadonlyArray<unknown>
    /** The answer of `getRawOne()`. */
    readonly getRawOne?: unknown
    /** The answer of `getCount()`. */
    readonly getCount?: number
}

/** A chainable stand-in for a typeorm query builder that records every chained call. */
export interface FakeQueryBuilder {
    /** The builder to hand back from `entityManager.createQueryBuilder`. */
    readonly builder: object
    /** Every chained call, in order. */
    readonly calls: Array<QueryBuilderCall>
    /** The recorded calls of one builder method. */
    callsOf(method: string): ReadonlyArray<ReadonlyArray<unknown>>
}

/** The mocked `createQueryBuilder` of an entity manager. */
export interface QueryBuilderQueue {
    /** Queues the builder the next `createQueryBuilder` call answers. */
    mockReturnValueOnce(value: SelectQueryBuilder<ObjectLiteral>): unknown
}

/** The part of a mocked entity manager that hands out query builders. */
export interface QueryBuilderSource {
    /** The mocked `createQueryBuilder`. */
    readonly createQueryBuilder: QueryBuilderQueue
}

const TERMINALS = ["execute", "getMany", "getOne", "getRawMany", "getRawOne", "getCount"] as const

/** The fake is a stand-in for a typeorm builder; this is the one place that says so to the type system. */
const isQueryBuilder = (_value: object): _value is SelectQueryBuilder<ObjectLiteral> => true

/** Builds a chainable query-builder double: every method returns the builder, the terminal methods answer `answers`. */
export const fakeQueryBuilder = (answers: QueryBuilderAnswers = {}): FakeQueryBuilder => {
    const calls: Array<QueryBuilderCall> = []
    const builder: object = new Proxy(
        {},
        {
            get: (_target, property) => {
                if (typeof property !== "string") return undefined
                return (...args: Array<unknown>) => {
                    calls.push({ method: property, args })
                    const terminal = TERMINALS.find((name) => name === property)
                    return terminal === undefined ? builder : Promise.resolve(answers[terminal])
                }
            },
        },
    )
    return {
        builder,
        calls,
        callsOf: (method) => calls.filter((call) => call.method === method).map((call) => call.args),
    }
}

/** Hands out one fake query builder per `createQueryBuilder` call of the manager, in order, and answers them back. */
export const queueQueryBuilders = (
    manager: QueryBuilderSource,
    answers: ReadonlyArray<QueryBuilderAnswers>,
): ReadonlyArray<FakeQueryBuilder> => {
    const fakes = answers.map((answer) => fakeQueryBuilder(answer))
    for (const fake of fakes) {
        if (isQueryBuilder(fake.builder)) manager.createQueryBuilder.mockReturnValueOnce(fake.builder)
    }
    return fakes
}
