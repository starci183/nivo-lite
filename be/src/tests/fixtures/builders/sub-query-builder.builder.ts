import type { MockEntityManager } from "@starci/jest-preset"
import type { FakeQueryBuilder, QueryBuilderAnswers, QueryBuilderCall } from "./fake-query-builder.builder"

/** The text a double query builder renders for any sub query, so a fragment built from it stays readable. */
export const SUB_QUERY_TEXT = "(sub)"

/**
 * A query builder double for aggregate reads: `subQuery()` answers another chainable double and `getQuery()` renders as
 * {@link SUB_QUERY_TEXT}, while the terminals answer what the spec set. Every call of the outer and the sub doubles is
 * recorded in one list, in order.
 */
export const subQueryBuilder = (answers: QueryBuilderAnswers): FakeQueryBuilder => {
    const calls: Array<QueryBuilderCall> = []
    const argsOfMethod = (method: string): ReadonlyArray<ReadonlyArray<unknown>> =>
        calls.filter((call) => call.method === method).map((call) => call.args)
    const make = (): object =>
        new Proxy(
            {},
            {
                get: (_target, property) => {
                    if (property === "calls") return calls
                    if (property === "builder") return proxy
                    if (property === "argsOf" || property === "callsOf") return argsOfMethod
                    if (typeof property !== "string" || property === "then") return undefined
                    return (...args: Array<unknown>) => {
                        calls.push({ method: property, args })
                        if (property === "getQuery") return SUB_QUERY_TEXT
                        if (property === "subQuery") return make()
                        if (!Object.hasOwn(answers, property)) return proxy
                        return Promise.resolve(Reflect.get(answers, property))
                    }
                },
            },
        )
    const proxy = make()
    return proxy as FakeQueryBuilder
}

/** Makes the next `createQueryBuilder` calls of the manager hand out one {@link subQueryBuilder} per answer, in order, and gives them back. */
export const queueSubQueryBuilders = (
    manager: Pick<MockEntityManager, "createQueryBuilder">,
    answers: ReadonlyArray<QueryBuilderAnswers>,
): ReadonlyArray<FakeQueryBuilder> => {
    const doubles = answers.map((answer) => subQueryBuilder(answer))
    for (const double of doubles) manager.createQueryBuilder.mockReturnValueOnce(double as never)
    return doubles
}
