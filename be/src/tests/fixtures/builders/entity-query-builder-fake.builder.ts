/** One chained call recorded on a fake query builder. */
export interface QueryBuilderCall {
    /** The builder method that was called. */
    readonly method: string
    /** The arguments it was called with. */
    readonly args: ReadonlyArray<unknown>
}

/** What the terminal methods of a fake query builder answer; a function is called when the terminal runs and its result returned. */
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
    /** The builder to hand back from `entityManager.createQueryBuilder`; typed `never` so it is assignable to whatever builder type the manager double expects, with no assertion in a spec. */
    readonly builder: never
    /** Every chained call, in order. */
    readonly calls: Array<QueryBuilderCall>
    /** The recorded calls of one builder method. */
    callsOf(method: string): ReadonlyArray<ReadonlyArray<unknown>>
}

const TERMINALS = ["execute", "getMany", "getOne", "getRawMany", "getRawOne", "getCount"] as const

/** Hands a chainable stand-in over as the builder type the manager double expects; the one place a double is typed `never`. */
export const builderOf = (target: object): never => target as never

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
                    if (terminal === undefined) return builder
                    const answer = answers[terminal]
                    return typeof answer === "function" ? (answer as () => unknown)() : Promise.resolve(answer)
                }
            },
        },
    )
    return {
        builder: builderOf(builder),
        calls,
        callsOf: (method) => calls.filter((call) => call.method === method).map((call) => call.args),
    }
}

/** Hands out one fake query builder per `createQueryBuilder` call of the manager, in order, and answers them back. */
export const queueQueryBuilders = (
    manager: { readonly createQueryBuilder: { mockReturnValueOnce(value: never): unknown } },
    answers: ReadonlyArray<QueryBuilderAnswers>,
): ReadonlyArray<FakeQueryBuilder> => {
    const fakes = answers.map((answer) => fakeQueryBuilder(answer))
    for (const fake of fakes) manager.createQueryBuilder.mockReturnValueOnce(fake.builder)
    return fakes
}
