import type { EntityDefinition } from "../entity/entity.types"
import { queryProblems } from "./query-problems"
import { q } from "./q"
import { CATALOG, LEAD } from "./query.fixture"
import type { Aggregate, IncludeSpec, OrderBy, Query, QueryProblem } from "./query.types"

const RECENT: OrderBy = [
    ["updatedAt", "desc"],
    ["id", "desc"],
]

const INCLUDE: IncludeSpec = { relation: "messages", select: ["body"], order: [["id", "desc"]], latest: 5 }

const LIST: Query = {
    from: "sales.lead",
    select: ["id", "stage", "data.tier"],
    order: RECENT,
    page: { size: 20 },
}

const problems = (tree: Query | Aggregate): ReadonlyArray<QueryProblem> => queryProblems(tree, CATALOG)
const only = (code: QueryProblem["code"], at: string): ReadonlyArray<QueryProblem> => [{ code, at }]

const MISSING_TARGET: EntityDefinition = { ...LEAD, relations: { owner: { kind: "toOne", target: "sales.nobody" } } }

describe("queryProblems of a list query", () => {
    it("accepts a query an index serves", () => {
        expect(problems(LIST)).toEqual([])
        expect(problems({ ...LIST, where: q.eq("stage", "won"), order: RECENT })).toEqual([])
    })

    it("refuses an unknown entity", () => {
        expect(problems({ ...LIST, from: "sales.nobody" })).toEqual(only("QUERY_ENTITY_UNKNOWN", "from"))
    })

    it("checks the selected fields", () => {
        expect(problems({ ...LIST, select: ["nope"] })).toEqual(only("QUERY_FIELD_UNKNOWN", "select[0]"))
        expect(problems({ ...LIST, select: ["id", "workspaceId"] })).toEqual(only("QUERY_OWNER_FIELD", "select[1]"))
        expect(problems({ ...LIST, select: ["data.missing"] })).toEqual(
            only("QUERY_CUSTOM_KEY_UNDECLARED", "select[0]"),
        )
        expect(problems({ ...LIST, select: ["data"] })).toEqual([])
        expect(problems({ ...LIST, select: Array.from({ length: 65 }, () => "id") })).toEqual(
            only("QUERY_BOUND_EXCEEDED", "select"),
        )
    })

    it("checks the where", () => {
        expect(problems({ ...LIST, where: q.eq("nope", 1) })).toEqual(only("QUERY_FIELD_UNKNOWN", "where.field"))
    })

    it("checks the joins", () => {
        expect(problems({ ...LIST, join: { owner: ["name"] } })).toEqual([])
        expect(problems({ ...LIST, join: { owner: ["nope"] } })).toEqual(only("QUERY_FIELD_UNKNOWN", "join.owner[0]"))
        expect(problems({ ...LIST, join: { owner: ["workspaceId"] } })).toEqual(
            only("QUERY_OWNER_FIELD", "join.owner[0]"),
        )
        expect(problems({ ...LIST, join: { nope: ["name"] } })).toEqual(only("QUERY_RELATION_UNKNOWN", "join.nope"))
        expect(problems({ ...LIST, join: { messages: ["body"] } })).toEqual(only("QUERY_OP_INVALID", "join.messages"))
        expect(
            queryProblems({ ...LIST, join: { owner: ["name"] } }, new Map([["sales.lead", MISSING_TARGET]])),
        ).toEqual(only("QUERY_ENTITY_UNKNOWN", "join.owner"))
    })

    it("bounds the joins at 8", () => {
        const join = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`owner${index}`, ["name"]]))
        expect(problems({ ...LIST, join })).toContainEqual({ code: "QUERY_BOUND_EXCEEDED", at: "join" })
    })

    it("checks the includes", () => {
        const spec = INCLUDE
        expect(problems({ ...LIST, include: [spec] })).toEqual([])
        expect(problems({ ...LIST, include: [{ ...spec, relation: "nope" }] })).toEqual(
            only("QUERY_RELATION_UNKNOWN", "include[0].relation"),
        )
        expect(problems({ ...LIST, include: [{ ...spec, relation: "owner" }] })).toEqual(
            only("QUERY_OP_INVALID", "include[0].relation"),
        )
        expect(problems({ ...LIST, include: [{ ...spec, select: ["nope"] }] })).toEqual(
            only("QUERY_FIELD_UNKNOWN", "include[0].select[0]"),
        )
        expect(problems({ ...LIST, include: [{ ...spec, order: [["createdAt", "desc"]] }] })).toEqual(
            only("QUERY_ORDER_NOT_TOTAL", "include[0].order"),
        )
        expect(problems({ ...LIST, include: [{ ...spec, latest: 20 }] })).toEqual([])
        expect(problems({ ...LIST, include: [{ ...spec, latest: 0 }] })).toEqual(
            only("QUERY_BOUND_EXCEEDED", "include[0].latest"),
        )
        expect(problems({ ...LIST, include: [{ ...spec, latest: 21 }] })).toEqual(
            only("QUERY_BOUND_EXCEEDED", "include[0].latest"),
        )
        expect(problems({ ...LIST, include: [{ ...spec, latest: 1.5 }] })).toEqual(
            only("QUERY_BOUND_EXCEEDED", "include[0].latest"),
        )
    })

    it("bounds the includes at 8", () => {
        expect(problems({ ...LIST, include: Array.from({ length: 9 }, () => INCLUDE) })).toContainEqual({
            code: "QUERY_BOUND_EXCEEDED",
            at: "include",
        })
    })

    it("needs an order that ends with the key", () => {
        expect(problems({ ...LIST, order: [] })).toEqual(only("QUERY_ORDER_NOT_TOTAL", "order"))
        expect(problems({ ...LIST, order: [["createdAt", "asc"]] })).toEqual(only("QUERY_ORDER_NOT_TOTAL", "order"))
    })

    it("checks the order fields", () => {
        expect(
            problems({
                ...LIST,
                order: [
                    ["nope", "asc"],
                    ["id", "asc"],
                ],
            }),
        ).toEqual(only("QUERY_FIELD_UNKNOWN", "order[0]"))
        expect(
            problems({
                ...LIST,
                order: [
                    ["data", "asc"],
                    ["id", "asc"],
                ],
            }),
        ).toEqual(only("QUERY_OP_INVALID", "order[0]"))
        expect(
            problems({
                ...LIST,
                order: [
                    ["data.score", "asc"],
                    ["id", "asc"],
                ],
            }),
        ).toEqual(only("QUERY_CUSTOM_KEY_UNDECLARED", "order[0]"))
    })

    it("bounds the order at 8 keys", () => {
        const order: OrderBy = [
            ...Array.from({ length: 8 }, (): readonly [string, "asc" | "desc"] => ["createdAt", "asc"]),
            ["id", "asc"],
        ]
        expect(problems({ ...LIST, order })).toContainEqual({ code: "QUERY_BOUND_EXCEEDED", at: "order" })
    })

    it("bounds the page size to 1..100", () => {
        expect(problems({ ...LIST, page: { size: 1 } })).toEqual([])
        expect(problems({ ...LIST, page: { size: 100 } })).toEqual([])
        expect(problems({ ...LIST, page: { size: 0 } })).toEqual(only("QUERY_BOUND_EXCEEDED", "page.size"))
        expect(problems({ ...LIST, page: { size: 101 } })).toEqual(only("QUERY_BOUND_EXCEEDED", "page.size"))
        expect(problems({ ...LIST, page: { size: 2.5 } })).toEqual(only("QUERY_BOUND_EXCEEDED", "page.size"))
    })

    it("refuses a list no declared index serves, and says so only when nothing else is wrong", () => {
        expect(
            problems({
                ...LIST,
                order: [
                    ["contactName", "asc"],
                    ["id", "asc"],
                ],
            }),
        ).toEqual(only("QUERY_NOT_INDEXED", "order"))
        expect(problems({ ...LIST, where: q.eq("channel", "zalo") })).toEqual(only("QUERY_NOT_INDEXED", "order"))
        expect(
            problems({
                ...LIST,
                select: ["nope"],
                order: [
                    ["contactName", "asc"],
                    ["id", "asc"],
                ],
            }),
        ).toEqual(only("QUERY_FIELD_UNKNOWN", "select[0]"))
    })
})

describe("queryProblems of an aggregate", () => {
    const COUNT: Aggregate = {
        from: "sales.lead",
        groupBy: ["stage"],
        measures: { count: { kind: "count" } },
        limit: 100,
    }

    it("accepts a grouped count and a bucketed sum", () => {
        expect(problems(COUNT)).toEqual([])
        expect(
            problems({
                from: "sales.lead",
                where: q.eq("stage", "won"),
                measures: { total: { kind: "sum", field: "amountVnd" }, mean: { kind: "avg", field: "data.score" } },
                bucket: { field: "createdAt", unit: "month" },
                limit: 12,
            }),
        ).toEqual([])
    })

    it("refuses an unknown entity and a bad where", () => {
        expect(problems({ ...COUNT, from: "sales.nobody" })).toEqual(only("QUERY_ENTITY_UNKNOWN", "from"))
        expect(problems({ ...COUNT, where: q.eq("nope", 1) })).toEqual(only("QUERY_FIELD_UNKNOWN", "where.field"))
    })

    it("checks the group by", () => {
        expect(problems({ ...COUNT, groupBy: ["nope"] })).toEqual(only("QUERY_FIELD_UNKNOWN", "groupBy[0]"))
        expect(problems({ ...COUNT, groupBy: ["data"] })).toEqual(only("QUERY_OP_INVALID", "groupBy[0]"))
        expect(problems({ ...COUNT, groupBy: ["stage", "channel", "active", "day"] })).toEqual(
            only("QUERY_BOUND_EXCEEDED", "groupBy"),
        )
    })

    it("checks the measures", () => {
        expect(problems({ ...COUNT, measures: {} })).toEqual(only("QUERY_BOUND_EXCEEDED", "measures"))
        const many = Array.from({ length: 17 }).reduce<Aggregate["measures"]>(
            (all, _item, index) => ({ ...all, [`m${index}`]: { kind: "count" } }),
            {},
        )
        expect(problems({ ...COUNT, measures: many })).toEqual(only("QUERY_BOUND_EXCEEDED", "measures"))
        expect(problems({ ...COUNT, measures: { c: { kind: "count", field: "active" } } })).toEqual([])
        expect(problems({ ...COUNT, measures: { c: { kind: "count", field: "nope" } } })).toEqual(
            only("QUERY_FIELD_UNKNOWN", "measures.c.field"),
        )
        expect(problems({ ...COUNT, measures: { c: { kind: "sum" } } })).toEqual(
            only("QUERY_OP_INVALID", "measures.c.field"),
        )
        expect(problems({ ...COUNT, measures: { c: { kind: "sum", field: "contactName" } } })).toEqual(
            only("QUERY_OP_INVALID", "measures.c.field"),
        )
        expect(problems({ ...COUNT, measures: { c: { kind: "avg", field: "total" } } })).toEqual([])
        expect(problems({ ...COUNT, measures: { c: { kind: "min", field: "contactName" } } })).toEqual([])
        expect(problems({ ...COUNT, measures: { c: { kind: "max", field: "createdAt" } } })).toEqual([])
        expect(problems({ ...COUNT, measures: { c: { kind: "max", field: "active" } } })).toEqual(
            only("QUERY_OP_INVALID", "measures.c.field"),
        )
    })

    it("checks the where of a measure", () => {
        expect(problems({ ...COUNT, measures: { open: { kind: "count", where: q.isNull("ownerId") } } })).toEqual([])
        expect(problems({ ...COUNT, measures: { open: { kind: "count", where: q.isNull("nope") } } })).toEqual(
            only("QUERY_FIELD_UNKNOWN", "measures.open.where.field"),
        )
    })

    it("checks the bucket", () => {
        expect(problems({ ...COUNT, bucket: { field: "day", unit: "week" } })).toEqual([])
        expect(problems({ ...COUNT, bucket: { field: "stage", unit: "day" } })).toEqual(
            only("QUERY_OP_INVALID", "bucket.field"),
        )
        expect(problems({ ...COUNT, bucket: { field: "nope", unit: "day" } })).toEqual(
            only("QUERY_FIELD_UNKNOWN", "bucket.field"),
        )
    })

    it("bounds the limit to 1..1000", () => {
        expect(problems({ ...COUNT, limit: 1000 })).toEqual([])
        expect(problems({ ...COUNT, limit: 0 })).toEqual(only("QUERY_BOUND_EXCEEDED", "limit"))
        expect(problems({ ...COUNT, limit: 1001 })).toEqual(only("QUERY_BOUND_EXCEEDED", "limit"))
        expect(problems({ ...COUNT, limit: 1.5 })).toEqual(only("QUERY_BOUND_EXCEEDED", "limit"))
    })
})
