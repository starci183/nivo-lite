import { Test } from "@nestjs/testing"
import { entityCatalogOf, leadEntityOf } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { mock } from "@starci/jest-preset"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import type { FilterExpr } from "@nivo-lite/agent-sdk/query"
import { builderOf } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { SUB_QUERY_TEXT, subQueryBuilder } from "@tests/fixtures/builders/sub-query-builder.builder"
import { RecordEntity, RecordLinkEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { filterFragment } from "./filter.policy"
import type { FilterScope, SubQueryHost } from "./filter.policy"
import { paramBag } from "./param-bag.policy"

const FILTER: unique symbol = Symbol("entity-engine.filter")

interface FilterPolicy {
    readonly filterFragment: typeof filterFragment
}

const build = async (): Promise<FilterPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: FILTER, useFactory: (): FilterPolicy => ({ filterFragment }) }],
    }).compile()
    return moduleRef.get<FilterPolicy>(FILTER)
}

const CATALOG = entityCatalogOf(mock<MetaShape>())
const LEAD = leadEntityOf(mock<MetaShape>())

/** A scope over the leads; the builder is only used by `has`. */
const scopeOf = (builder: SubQueryHost = builderOf(subQueryBuilder({}).builder)) => {
    const params = paramBag("p")
    const scope: FilterScope = { catalog: CATALOG, entity: LEAD, alias: "r", params, builder, depth: 0 }
    return { scope, params }
}

/** The text of `data ->> field` for the first parameter, which most expectations start with. */
const STAGE = "r.data ->> CAST(:p0 AS text)"
const AMOUNT = "CAST(r.data ->> CAST(:p0 AS text) AS integer)"

describe("filterFragment > compare", () => {
    it.each([
        ["eq", "="],
        ["ne", "IS DISTINCT FROM"],
        ["lt", "<"],
        ["lte", "<="],
        ["gt", ">"],
        ["gte", ">="],
    ] as const)("compares a field with a bound value by %s", async (op, symbol) => {
        const policy = await build()
        const { scope, params } = scopeOf()

        expect(policy.filterFragment({ op, field: "stage", value: "won" }, scope)).toBe(`${STAGE} ${symbol} :p1`)
        expect(params.values()).toEqual({ p0: "stage", p1: "won" })
    })

    it("casts a numeric field to its kind", async () => {
        const policy = await build()
        const { scope } = scopeOf()

        expect(policy.filterFragment({ op: "lt", field: "amount", value: 5 }, scope)).toBe(`${AMOUNT} < :p1`)
    })

    it("compares a field with another field", async () => {
        const policy = await build()
        const { scope } = scopeOf()

        expect(policy.filterFragment({ op: "gte", field: "amount", ref: "total" }, scope)).toBe(
            `${AMOUNT} >= CAST(r.data ->> CAST(:p1 AS text) AS bigint)`,
        )
    })

    it("turns a comparison with null into a null test", async () => {
        const policy = await build()

        expect(policy.filterFragment({ op: "eq", field: "stage", value: null }, scopeOf().scope)).toBe(
            `${STAGE} IS NULL`,
        )
        expect(policy.filterFragment({ op: "ne", field: "stage" }, scopeOf().scope)).toBe(`${STAGE} IS NOT NULL`)
        expect(policy.filterFragment({ op: "gt", field: "stage", value: null }, scopeOf().scope)).toBe("FALSE")
    })
})

describe("filterFragment > membership", () => {
    it("tests membership of a bound list", async () => {
        const policy = await build()
        const { scope, params } = scopeOf()

        expect(policy.filterFragment({ op: "in", field: "stage", values: ["new", "won"] }, scope)).toBe(
            `(${STAGE} IN (:...p1))`,
        )
        expect(params.values()).toEqual({ p0: "stage", p1: ["new", "won"] })
    })

    it("lets null count as a member of an in list", async () => {
        const policy = await build()

        expect(policy.filterFragment({ op: "in", field: "stage", values: ["new", null] }, scopeOf().scope)).toBe(
            `(${STAGE} IN (:...p1) OR ${STAGE} IS NULL)`,
        )
        expect(policy.filterFragment({ op: "in", field: "stage", values: [null] }, scopeOf().scope)).toBe(
            `(${STAGE} IS NULL)`,
        )
        expect(policy.filterFragment({ op: "in", field: "stage", values: [] }, scopeOf().scope)).toBe("FALSE")
    })

    it("keeps rows without a value in a notIn list unless null is listed", async () => {
        const policy = await build()

        expect(policy.filterFragment({ op: "notIn", field: "stage", values: ["new"] }, scopeOf().scope)).toBe(
            `((${STAGE} IS NULL OR ${STAGE} NOT IN (:...p1)))`,
        )
        expect(policy.filterFragment({ op: "notIn", field: "stage", values: ["new", null] }, scopeOf().scope)).toBe(
            `(${STAGE} NOT IN (:...p1) AND ${STAGE} IS NOT NULL)`,
        )
        expect(policy.filterFragment({ op: "notIn", field: "stage", values: [null] }, scopeOf().scope)).toBe(
            `(${STAGE} IS NOT NULL)`,
        )
        expect(policy.filterFragment({ op: "notIn", field: "stage", values: [] }, scopeOf().scope)).toBe("TRUE")
    })
})

describe("filterFragment > null tests", () => {
    it("tests a field for null and not null", async () => {
        const policy = await build()

        expect(policy.filterFragment({ op: "isNull", field: "stage" }, scopeOf().scope)).toBe(`${STAGE} IS NULL`)
        expect(policy.filterFragment({ op: "notNull", field: "stage" }, scopeOf().scope)).toBe(`${STAGE} IS NOT NULL`)
    })
})

describe("filterFragment > search", () => {
    it("matches the escaped text in any of the folded fields", async () => {
        const policy = await build()
        const { scope, params } = scopeOf()

        expect(policy.filterFragment({ op: "search", fields: ["contactName", "phone"], text: "50%" }, scope)).toBe(
            "(public.knowledge_fold(r.data ->> CAST(:p1 AS text)) LIKE public.knowledge_fold(:p0) OR public.knowledge_fold(r.data ->> CAST(:p2 AS text)) LIKE public.knowledge_fold(:p0))",
        )
        expect(params.values()).toEqual({ p0: "%50\\%%", p1: "contactName", p2: "phone" })
    })

    it("matches nothing when no field is searched", async () => {
        const policy = await build()

        expect(policy.filterFragment({ op: "search", fields: [], text: "x" }, scopeOf().scope)).toBe("FALSE")
    })
})

describe("filterFragment > overlaps", () => {
    it("intersects the row's range with the bound window", async () => {
        const policy = await build()
        const { scope, params } = scopeOf()

        expect(
            policy.filterFragment(
                {
                    op: "overlaps",
                    range: ["closedAt", "seenAt"],
                    from: "2026-11-01T00:00:00Z",
                    to: "2026-11-30T00:00:00Z",
                },
                scope,
            ),
        ).toBe(
            "tstzrange(CAST(r.data ->> CAST(:p0 AS text) AS timestamptz), CAST(r.data ->> CAST(:p1 AS text) AS timestamptz)) && tstzrange(CAST(:p2 AS timestamptz), CAST(:p3 AS timestamptz))",
        )
        expect(params.values()).toEqual({
            p0: "closedAt",
            p1: "seenAt",
            p2: "2026-11-01T00:00:00Z",
            p3: "2026-11-30T00:00:00Z",
        })
    })

    it("reads system timestamps as columns", async () => {
        const policy = await build()

        expect(
            policy.filterFragment(
                { op: "overlaps", range: ["createdAt", "updatedAt"], from: "a", to: "b" },
                scopeOf().scope,
            ),
        ).toBe("tstzrange(r.createdAt, r.updatedAt) && tstzrange(CAST(:p0 AS timestamptz), CAST(:p1 AS timestamptz))")
    })
})

describe("filterFragment > boolean groups", () => {
    const isNull: FilterExpr = { op: "isNull", field: "stage" }

    it("joins the operands of and / or in parentheses", async () => {
        const policy = await build()

        expect(policy.filterFragment({ op: "and", of: [isNull, isNull] }, scopeOf().scope)).toBe(
            "(r.data ->> CAST(:p0 AS text) IS NULL AND r.data ->> CAST(:p1 AS text) IS NULL)",
        )
        expect(policy.filterFragment({ op: "or", of: [isNull] }, scopeOf().scope)).toBe(`(${STAGE} IS NULL)`)
    })

    it("answers true for an empty and and false for an empty or", async () => {
        const policy = await build()

        expect(policy.filterFragment({ op: "and", of: [] }, scopeOf().scope)).toBe("TRUE")
        expect(policy.filterFragment({ op: "or", of: [] }, scopeOf().scope)).toBe("FALSE")
    })

    it("negates an expression", async () => {
        const policy = await build()

        expect(policy.filterFragment({ op: "not", of: isNull }, scopeOf().scope)).toBe(`NOT (${STAGE} IS NULL)`)
    })

    it("refuses an unknown field anywhere in the tree", async () => {
        const policy = await build()

        expect(() =>
            policy.filterFragment({ op: "and", of: [{ op: "isNull", field: "ghost" }] }, scopeOf().scope),
        ).toThrow(EntityEngineErrorCode.FieldUnknown)
    })
})

describe("filterFragment > has", () => {
    it("tests existence of a linked record in a correlated sub-query", async () => {
        const policy = await build()
        const double = subQueryBuilder({})
        const { scope, params } = scopeOf(builderOf(double.builder))

        expect(policy.filterFragment({ op: "has", relation: "tasks" }, scope)).toBe(`EXISTS ${SUB_QUERY_TEXT}`)
        expect(double.callsOf("select")).toEqual([["1"]])
        expect(double.callsOf("from")).toEqual([[RecordLinkEntity, "l0"]])
        expect(double.callsOf("innerJoin")).toEqual([
            [RecordEntity, "t0", "t0.entity = l0.toEntity AND t0.id = l0.toId AND t0.workspaceId = l0.workspaceId"],
        ])
        expect(double.callsOf("where")).toEqual([
            [
                "l0.workspaceId = r.workspaceId AND l0.fromEntity = :p0 AND l0.fromId = r.id AND l0.relation = :p1 AND l0.toEntity = :p2",
            ],
        ])
        expect(double.callsOf("andWhere")).toEqual([])
        expect(params.values()).toEqual({ p0: "sales.lead", p1: "tasks", p2: "sales.task" })
    })

    it("narrows the linked record with the nested filter one level deeper", async () => {
        const policy = await build()
        const double = subQueryBuilder({})
        const { scope, params } = scopeOf(builderOf(double.builder))

        policy.filterFragment(
            { op: "has", relation: "tasks", where: { op: "eq", field: "title", value: "call" } },
            scope,
        )

        expect(double.callsOf("andWhere")).toEqual([["t0.data ->> CAST(:p3 AS text) = :p4"]])
        expect(params.values()).toMatchObject({ p3: "title", p4: "call" })
    })

    it("refuses a relation the entity does not declare", async () => {
        const policy = await build()

        expect(() => policy.filterFragment({ op: "has", relation: "ghost" }, scopeOf().scope)).toThrow(
            EntityEngineErrorCode.RelationUnknown,
        )
    })
})
