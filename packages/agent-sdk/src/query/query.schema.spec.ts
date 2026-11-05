import { aggregateSchema, filterExprSchema, querySchema } from "./query.schema"
import { q } from "./q"
import type { FilterExpr } from "./query.types"

const nested = (levels: number): FilterExpr =>
    Array.from({ length: levels - 1 }).reduce<FilterExpr>((inner) => q.not(inner), q.isNull("channel"))

const QUERY = {
    from: "sales.lead",
    select: ["id", "stage"],
    order: [["id", "asc"]],
    page: { size: 20 },
}

describe("filterExprSchema", () => {
    it("parses every kind of expression", () => {
        const expr = q.and(
            q.eq("stage", "won"),
            q.ltRef("endsAt", "startsAt"),
            q.in("stage", ["new", "won"]),
            q.notNull("channel"),
            q.search(["contactName"], "dinh"),
            q.overlaps(["startsAt", "endsAt"], "2026-01-01", "2026-02-01"),
            q.or(q.not(q.eq("active", true)), q.has("messages", q.eq("body", "hi")), q.has("messages")),
            q.eq("data.tier", "gold"),
        )
        expect(filterExprSchema.parse(expr)).toEqual(expr)
    })

    it("refuses a comparison with both a value and a ref, or with neither", () => {
        expect(filterExprSchema.safeParse({ op: "eq", field: "a", value: 1, ref: "b" }).success).toBe(false)
        expect(filterExprSchema.safeParse({ op: "eq", field: "a" }).success).toBe(false)
    })

    it("refuses an unknown op, an unknown key and a bad field name", () => {
        expect(filterExprSchema.safeParse({ op: "like", field: "a", value: "x" }).success).toBe(false)
        expect(filterExprSchema.safeParse({ op: "isNull", field: "a", extra: 1 }).success).toBe(false)
        expect(filterExprSchema.safeParse(q.isNull("__proto__")).success).toBe(false)
        expect(filterExprSchema.safeParse(q.isNull("a b")).success).toBe(false)
        expect(filterExprSchema.safeParse(q.isNull("a".repeat(121))).success).toBe(false)
    })

    it("bounds the lists, the text and the width", () => {
        expect(
            filterExprSchema.safeParse(
                q.in(
                    "a",
                    Array.from({ length: 500 }, () => 1),
                ),
            ).success,
        ).toBe(true)
        expect(
            filterExprSchema.safeParse(
                q.in(
                    "a",
                    Array.from({ length: 501 }, () => 1),
                ),
            ).success,
        ).toBe(false)
        expect(filterExprSchema.safeParse(q.search(["a"], "x".repeat(200))).success).toBe(true)
        expect(filterExprSchema.safeParse(q.search(["a"], "x".repeat(201))).success).toBe(false)
        expect(filterExprSchema.safeParse(q.search([], "x")).success).toBe(false)
        expect(filterExprSchema.safeParse(q.and(...Array.from({ length: 32 }, () => q.isNull("a")))).success).toBe(true)
        expect(filterExprSchema.safeParse(q.and(...Array.from({ length: 33 }, () => q.isNull("a")))).success).toBe(
            false,
        )
        expect(filterExprSchema.safeParse(q.and()).success).toBe(false)
    })

    it("bounds the depth at 6", () => {
        expect(filterExprSchema.safeParse(nested(6)).success).toBe(true)
        expect(filterExprSchema.safeParse(nested(7)).success).toBe(false)
    })
})

describe("querySchema", () => {
    it("parses a list query with joins, includes and a cursor", () => {
        const tree = {
            ...QUERY,
            join: { owner: ["name"] },
            include: [{ relation: "messages", select: ["body"], order: [["id", "desc"]], latest: 3 }],
            where: q.eq("stage", "won"),
            page: { size: 100, after: "cursor" },
        }
        expect(querySchema.parse(tree)).toEqual(tree)
        expect(querySchema.parse(QUERY)).toEqual(QUERY)
    })

    it("refuses what exceeds a bound", () => {
        expect(querySchema.safeParse({ ...QUERY, page: { size: 101 } }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, page: { size: 0 } }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, page: { size: 1.5 } }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, page: { size: 5, after: "x".repeat(2001) } }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, select: [] }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, select: Array.from({ length: 65 }, () => "id") }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, order: [] }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, order: Array.from({ length: 9 }, () => ["id", "asc"]) }).success).toBe(
            false,
        )
        expect(querySchema.safeParse({ ...QUERY, order: [["id", "up"]] }).success).toBe(false)
        const joins = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`owner${index}`, ["name"]]))
        expect(querySchema.safeParse({ ...QUERY, join: joins }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, join: { __proto__x: ["name"] } }).success).toBe(false)
        const include = { relation: "messages", select: ["body"], order: [["id", "desc"]], latest: 20 }
        expect(querySchema.safeParse({ ...QUERY, include: [include] }).success).toBe(true)
        expect(querySchema.safeParse({ ...QUERY, include: [{ ...include, latest: 21 }] }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, include: Array.from({ length: 9 }, () => include) }).success).toBe(
            false,
        )
    })

    it("refuses an unknown key and a malformed entity name", () => {
        expect(querySchema.safeParse({ ...QUERY, sql: "select 1" }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, from: "Leads" }).success).toBe(false)
        expect(querySchema.safeParse({ ...QUERY, from: "sales.lead x" }).success).toBe(false)
    })
})

describe("aggregateSchema", () => {
    const AGGREGATE = {
        from: "sales.lead",
        where: q.eq("stage", "won"),
        groupBy: ["stage", "channel", "active"],
        measures: { total: { kind: "sum", field: "amountVnd" }, n: { kind: "count", where: q.eq("stage", "won") } },
        bucket: { field: "createdAt", unit: "month" },
        limit: 1000,
    }

    it("parses an aggregate", () => {
        expect(aggregateSchema.parse(AGGREGATE)).toEqual(AGGREGATE)
        expect(aggregateSchema.parse({ from: "sales.lead", measures: { n: { kind: "count" } }, limit: 1 })).toEqual({
            from: "sales.lead",
            measures: { n: { kind: "count" } },
            limit: 1,
        })
    })

    it("refuses what exceeds a bound or names something unknown", () => {
        expect(aggregateSchema.safeParse({ ...AGGREGATE, limit: 1001 }).success).toBe(false)
        expect(aggregateSchema.safeParse({ ...AGGREGATE, limit: 0 }).success).toBe(false)
        expect(aggregateSchema.safeParse({ ...AGGREGATE, groupBy: ["a", "b", "c", "d"] }).success).toBe(false)
        expect(aggregateSchema.safeParse({ ...AGGREGATE, measures: { n: { kind: "median" } } }).success).toBe(false)
        expect(aggregateSchema.safeParse({ ...AGGREGATE, bucket: { field: "createdAt", unit: "year" } }).success).toBe(
            false,
        )
        const measures = Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`m${index}`, { kind: "count" }]))
        expect(aggregateSchema.safeParse({ ...AGGREGATE, measures }).success).toBe(false)
    })
})
