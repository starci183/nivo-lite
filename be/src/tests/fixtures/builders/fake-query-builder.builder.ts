import type { MockEntityManager } from "@starci/jest-preset"

/** The answers of the terminal calls of a query builder; an `Error` answer rejects and a function answer is called when the terminal runs. */
export interface QueryBuilderAnswers {
    /** `getMany()`. */
    readonly getMany?: ReadonlyArray<unknown>
    /** `getOne()`. */
    readonly getOne?: unknown
    /** `getRawMany()`. */
    readonly getRawMany?: ReadonlyArray<unknown>
    /** `getRawOne()`. */
    readonly getRawOne?: unknown
    /** `getCount()`. */
    readonly getCount?: number
    /** `getExists()`. */
    readonly getExists?: boolean
    /** `getRawAndEntities()`. */
    readonly getRawAndEntities?: unknown
    /** `execute()`, `UpdateResult`/`InsertResult`/`DeleteResult` shaped. */
    readonly execute?: unknown
}

/** One chained call recorded on a fake query builder. */
export interface QueryBuilderCall {
    /** The method name, for example `where`. */
    readonly method: string
    /** The arguments it got. */
    readonly args: ReadonlyArray<unknown>
}

/** A query builder double: every chained method answers itself and is recorded; terminals answer what the spec set. */
export interface FakeQueryBuilder {
    /** The double itself, to hand back from `entityManager.createQueryBuilder`. */
    readonly builder: object
    /** Every call, in order, terminals included. */
    readonly calls: ReadonlyArray<QueryBuilderCall>
    /** The arguments of every call of one method, in order. */
    argsOf(method: string): ReadonlyArray<ReadonlyArray<unknown>>
    /** The arguments of every call of one method, in order (the name the other lanes use). */
    callsOf(method: string): ReadonlyArray<ReadonlyArray<unknown>>
}

const TERMINALS: ReadonlyArray<keyof QueryBuilderAnswers> = [
    "getMany",
    "getOne",
    "getRawMany",
    "getRawOne",
    "getCount",
    "getExists",
    "getRawAndEntities",
    "execute",
]

/** Makes a chainable query builder double; hand it to `answerQueryBuilders` to make `em.createQueryBuilder` return it. */
export const fakeQueryBuilder = (
    answering: QueryBuilderAnswers | ((calls: ReadonlyArray<QueryBuilderCall>) => QueryBuilderAnswers) = {},
): FakeQueryBuilder => {
    const calls: Array<QueryBuilderCall> = []
    const argsOfMethod = (method: string): ReadonlyArray<ReadonlyArray<unknown>> =>
        calls.filter((call) => call.method === method).map((call) => call.args)
    const proxy: object = new Proxy(
        {},
        {
            get(_target, property) {
                if (property === "calls") return calls
                if (property === "builder") return proxy
                if (property === "argsOf" || property === "callsOf") return argsOfMethod

                if (typeof property !== "string" || property === "then") return undefined
                return (...args: Array<unknown>) => {
                    calls.push({ method: property, args })
                    const terminal = TERMINALS.find((name) => name === property)
                    if (terminal === undefined) return proxy
                    const answers = typeof answering === "function" ? answering(calls) : answering
                    if (!Object.hasOwn(answers, terminal)) {
                        return Promise.reject(
                            new Error(`fake query builder: ${terminal}() was not answered by the spec`),
                        )
                    }
                    const answer = answers[terminal]
                    if (answer instanceof Error) return Promise.reject(answer)
                    return Promise.resolve(typeof answer === "function" ? Reflect.apply(answer, undefined, []) : answer)
                }
            },
        },
    )
    return proxy as FakeQueryBuilder
}

/** Makes `em.createQueryBuilder(...)` hand out the given doubles, one per call in order; the last one repeats. */
export const answerQueryBuilders = (em: MockEntityManager, ...builders: ReadonlyArray<FakeQueryBuilder>): void => {
    let next = 0
    em.createQueryBuilder.mockImplementation((() => {
        const builder = builders[Math.min(next, builders.length - 1)]
        next += 1
        return builder
    }) as never)
}

/**
 * Makes `em.createQueryBuilder(...)` hand out a fresh double per call, answered by the table its `from(table, alias)` names:
 * the key `"<table> <alias>"` wins over `"<table>"`. Answers the doubles built so far, in order, for the spec to inspect.
 */
export const answerQueryBuildersByTable = (
    em: MockEntityManager,
    answers: Readonly<Record<string, QueryBuilderAnswers>>,
): ReadonlyArray<FakeQueryBuilder> => {
    const built: Array<FakeQueryBuilder> = []
    em.createQueryBuilder.mockImplementation((() => {
        const builder = fakeQueryBuilder((calls) => {
            const from = calls.find((call) => call.method === "from")
            const table = String(from?.args[0])
            return answers[`${table} ${String(from?.args[1])}`] ?? answers[table] ?? {}
        })
        built.push(builder)
        return builder
    }) as never)
    return built
}

/** Hands out one fake query builder per `createQueryBuilder` call of the manager, in order, and answers them back. */
export const queueQueryBuilders = (
    manager: Pick<MockEntityManager, "createQueryBuilder">,
    answers: ReadonlyArray<QueryBuilderAnswers>,
): ReadonlyArray<FakeQueryBuilder> => {
    const fakes = answers.map((answer) => fakeQueryBuilder(answer))
    for (const fake of fakes) manager.createQueryBuilder.mockReturnValueOnce(fake as never)
    return fakes
}

/** Matches any function in an assertion (a `() => ...` SQL expression a spec cannot compare by value). */
export const ANY_FUNCTION: unknown = expect.any(Function)
