import { filterProblems, relationTarget } from "./filter-problems"
import { q } from "./q"
import { CATALOG, LEAD, OWNER } from "./query.fixture"
import type { FilterExpr, QueryProblem } from "./query.types"

const run = (expr: FilterExpr): ReadonlyArray<QueryProblem> => filterProblems(LEAD, CATALOG, expr, "where", 1)
const only = (code: QueryProblem["code"], at: string): ReadonlyArray<QueryProblem> => [{ code, at }]

const nested = (levels: number): FilterExpr =>
    Array.from({ length: levels - 1 }).reduce<FilterExpr>((inner) => q.not(inner), q.isNull("channel"))

describe("filterProblems comparisons", () => {
    it("accepts a literal that fits the field", () => {
        expect(run(q.eq("stage", "won"))).toEqual([])
        expect(run(q.eq("active", true))).toEqual([])
        expect(run(q.gte("amountVnd", 5))).toEqual([])
        expect(run(q.lte("amountVnd", 5))).toEqual([])
        expect(run(q.lt("createdAt", "2026-01-01"))).toEqual([])
        expect(run(q.eq("total", 5))).toEqual([])
        expect(run(q.gt("version", "7"))).toEqual([])
        expect(run(q.eq("total", "-123"))).toEqual([])
        expect(run(q.gt("data.score", 3))).toEqual([])
        expect(run(q.eq("data.tier", "gold"))).toEqual([])
    })

    it("accepts null only for eq and ne on a nullable field", () => {
        expect(run(q.eq("channel", null))).toEqual([])
        expect(run(q.ne("channel", null))).toEqual([])
        expect(run(q.eq("contactName", null))).toEqual(only("QUERY_OP_INVALID", "where.value"))
        expect(run(q.lt("amountVnd", null))).toEqual(only("QUERY_OP_INVALID", "where.value"))
    })

    it("refuses an order comparison on a bool or a whole jsonb", () => {
        expect(run(q.lt("active", true))).toEqual(only("QUERY_OP_INVALID", "where.op"))
        expect(run(q.eq("data", "x"))).toEqual([
            { code: "QUERY_OP_INVALID", at: "where.op" },
            { code: "QUERY_OP_INVALID", at: "where.value" },
        ])
    })

    it("refuses a literal of the wrong type", () => {
        expect(run(q.eq("stage", 5))).toEqual(only("QUERY_OP_INVALID", "where.value"))
        expect(run(q.eq("active", "yes"))).toEqual(only("QUERY_OP_INVALID", "where.value"))
        expect(run(q.eq("amountVnd", "5"))).toEqual(only("QUERY_OP_INVALID", "where.value"))
        expect(run(q.eq("total", "abc"))).toEqual(only("QUERY_OP_INVALID", "where.value"))
        expect(run(q.eq("amountVnd", "-5"))).toEqual(only("QUERY_OP_INVALID", "where.value"))
    })

    it("needs exactly one of value and ref", () => {
        expect(run({ op: "eq", field: "stage" })).toEqual(only("QUERY_OP_INVALID", "where"))
        expect(run({ op: "eq", field: "stage", value: "won", ref: "stage" })).toEqual(only("QUERY_OP_INVALID", "where"))
    })

    it("compares with another field of the same family", () => {
        expect(run(q.ltRef("endsAt", "startsAt"))).toEqual([])
        expect(run(q.eqRef("endsAt", "stage"))).toEqual(only("QUERY_OP_INVALID", "where.ref"))
        expect(run(q.eqRef("endsAt", "nope"))).toEqual(only("QUERY_FIELD_UNKNOWN", "where.ref"))
        expect(run(q.eqRef("endsAt", "workspaceId"))).toEqual(only("QUERY_OWNER_FIELD", "where.ref"))
    })

    it("names the unknown, owner and undeclared custom fields", () => {
        expect(run(q.eq("nope", 1))).toEqual(only("QUERY_FIELD_UNKNOWN", "where.field"))
        expect(run(q.eq("workspaceId", "x"))).toEqual(only("QUERY_OWNER_FIELD", "where.field"))
        expect(run(q.eq("data.note", "x"))).toEqual(only("QUERY_CUSTOM_KEY_UNDECLARED", "where.field"))
    })
})

describe("filterProblems membership and null checks", () => {
    it("accepts values that fit", () => {
        expect(run(q.in("stage", ["new", "won"]))).toEqual([])
        expect(run(q.notIn("total", [1, "2"]))).toEqual([])
    })

    it("refuses a whole jsonb, a null, a misfit and an unknown field", () => {
        expect(run(q.in("data", ["x"]))).toEqual([
            { code: "QUERY_OP_INVALID", at: "where.field" },
            { code: "QUERY_OP_INVALID", at: "where.values" },
        ])
        expect(run(q.in("stage", [null]))).toEqual(only("QUERY_OP_INVALID", "where.values"))
        expect(run(q.in("stage", [1]))).toEqual(only("QUERY_OP_INVALID", "where.values"))
        expect(run(q.in("nope", ["x"]))).toEqual(only("QUERY_FIELD_UNKNOWN", "where.field"))
    })

    it("bounds the values at 500", () => {
        expect(
            run(
                q.in(
                    "stage",
                    Array.from({ length: 500 }, () => "new"),
                ),
            ),
        ).toEqual([])
        expect(
            run(
                q.in(
                    "stage",
                    Array.from({ length: 501 }, () => "new"),
                ),
            ),
        ).toEqual(only("QUERY_BOUND_EXCEEDED", "where.values"))
    })

    it("checks the field of a null check", () => {
        expect(run(q.isNull("channel"))).toEqual([])
        expect(run(q.notNull("nope"))).toEqual(only("QUERY_FIELD_UNKNOWN", "where.field"))
    })
})

describe("filterProblems search and overlaps", () => {
    it("accepts text fields, custom text keys included", () => {
        expect(run(q.search(["contactName", "channel", "data.tier"], "dinh"))).toEqual([])
    })

    it("refuses what cannot be searched", () => {
        expect(run(q.search([], "x"))).toEqual(only("QUERY_OP_INVALID", "where.fields"))
        expect(run(q.search(["stage"], "x"))).toEqual(only("QUERY_OP_INVALID", "where.fields[0]"))
        expect(run(q.search(["nope"], "x"))).toEqual(only("QUERY_FIELD_UNKNOWN", "where.fields[0]"))
    })

    it("bounds the fields at 8 and the text at 200", () => {
        expect(
            run(
                q.search(
                    Array.from({ length: 9 }, () => "contactName"),
                    "x",
                ),
            ),
        ).toEqual(only("QUERY_BOUND_EXCEEDED", "where"))
        expect(run(q.search(["contactName"], "a".repeat(200)))).toEqual([])
        expect(run(q.search(["contactName"], "a".repeat(201)))).toEqual(only("QUERY_BOUND_EXCEEDED", "where"))
    })

    it("overlaps two timestamptz fields", () => {
        expect(run(q.overlaps(["startsAt", "endsAt"], "a", "b"))).toEqual([])
        expect(run(q.overlaps(["startsAt", "day"], "a", "b"))).toEqual(only("QUERY_OP_INVALID", "where.range[1]"))
        expect(run(q.overlaps(["nope", "endsAt"], "a", "b"))).toEqual(only("QUERY_FIELD_UNKNOWN", "where.range[0]"))
    })
})

describe("filterProblems combinators and bounds", () => {
    it("walks and, or and not", () => {
        expect(run(q.and(q.eq("stage", "won"), q.or(q.isNull("channel"), q.not(q.eq("active", true)))))).toEqual([])
        expect(run(q.and(q.eq("nope", 1), q.not(q.eq("workspaceId", "x"))))).toEqual([
            { code: "QUERY_FIELD_UNKNOWN", at: "where.of[0].field" },
            { code: "QUERY_OWNER_FIELD", at: "where.of[1].of.field" },
        ])
    })

    it("refuses an empty and, and a width over 32", () => {
        expect(run(q.and())).toEqual(only("QUERY_OP_INVALID", "where.of"))
        expect(run(q.or(...Array.from({ length: 32 }, () => q.isNull("channel"))))).toEqual([])
        expect(run(q.or(...Array.from({ length: 33 }, () => q.isNull("channel"))))).toEqual(
            only("QUERY_BOUND_EXCEEDED", "where.of"),
        )
    })

    it("bounds the depth at 6", () => {
        expect(run(nested(6))).toEqual([])
        expect(run(nested(7))).toEqual(only("QUERY_BOUND_EXCEEDED", "where.of.of.of.of.of.of"))
    })

    it("walks has into the target entity", () => {
        expect(run(q.has("messages"))).toEqual([])
        expect(run(q.has("messages", q.eq("body", "hi")))).toEqual([])
        expect(run(q.has("messages", q.eq("nope", "hi")))).toEqual(only("QUERY_FIELD_UNKNOWN", "where.where.field"))
        expect(run(q.has("messages", q.eq("workspaceId", "x")))).toEqual(only("QUERY_OWNER_FIELD", "where.where.field"))
    })

    it("refuses a has that names no toMany relation of the catalog", () => {
        expect(run(q.has("nope"))).toEqual(only("QUERY_RELATION_UNKNOWN", "where.relation"))
        expect(run(q.has("owner"))).toEqual(only("QUERY_OP_INVALID", "where.relation"))
        expect(run(q.has("ghosts"))).toEqual(only("QUERY_ENTITY_UNKNOWN", "where.relation"))
    })
})

describe("relationTarget", () => {
    it("finds the target of a relation of the wanted kind", () => {
        expect(relationTarget(LEAD, CATALOG, "owner", "toOne", "at").target?.name).toBe("sales.owner")
    })

    it("says why an entity without relations has no target", () => {
        expect(relationTarget(OWNER, CATALOG, "owner", "toOne", "at")).toEqual({
            target: null,
            problems: [{ code: "QUERY_RELATION_UNKNOWN", at: "at" }],
        })
    })
})
