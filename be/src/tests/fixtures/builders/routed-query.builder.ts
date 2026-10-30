import { builderOf, fakeQueryBuilder } from "./entity-query-builder-fake.builder"
import type { FakeQueryBuilder } from "./entity-query-builder-fake.builder"

/** What a routed builder answers: each terminal decides from the calls recorded on the builder so far. */
export interface QueryBuilderRoutes {
    /** The answer of `getRawMany()`. */
    readonly getRawMany?: (fake: FakeQueryBuilder) => Promise<unknown>
    /** The answer of `getRawOne()`. */
    readonly getRawOne?: (fake: FakeQueryBuilder) => Promise<unknown>
}

const routeOf = (
    routes: QueryBuilderRoutes,
    property: string,
): ((fake: FakeQueryBuilder) => Promise<unknown>) | undefined => {
    if (property === "getRawMany") return routes.getRawMany
    if (property === "getRawOne") return routes.getRawOne
    return undefined
}

/**
 * A chainable query-builder double like `fakeQueryBuilder`, whose raw reads answer by what was chained (the table read, the filter),
 * so one `createQueryBuilder` mock can serve every read of a service.
 */
export const routedQueryBuilder = (routes: QueryBuilderRoutes): FakeQueryBuilder => {
    const fake = fakeQueryBuilder()
    const wrap = (target: object): object =>
        new Proxy(target, {
            get: (inner, property) => {
                if (typeof property !== "string") return undefined
                const method: unknown = Reflect.get(inner, property)
                const route = routeOf(routes, property)
                return (...args: Array<unknown>) => {
                    const result: unknown =
                        typeof method === "function" ? Reflect.apply(method, undefined, args) : undefined
                    if (route !== undefined) return route(routed)
                    return result === fake.builder ? wrap(inner) : result
                }
            },
        })
    const routed: FakeQueryBuilder = {
        builder: builderOf(wrap(fake.builder)),
        calls: fake.calls,
        callsOf: fake.callsOf,
    }
    return routed
}
