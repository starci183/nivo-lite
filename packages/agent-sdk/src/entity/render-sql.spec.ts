import type { FilterExpr } from "../query/query.types"
import type { EntityDefinition } from "./entity.types"
import { EntityRenderError } from "./render-error"
import { dataKey, exprOf, filterSql, jsonOf, keyExprOf, quoteIdent, quoteLiteral, textOf } from "./render-sql"

const entity: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: {
        name: { kind: "text", nullable: false, maxLength: 200 },
        age: { kind: "int", nullable: true },
        big: { kind: "bigint", nullable: true },
        paid: { kind: "bool", nullable: true },
        owner: { kind: "uuid", nullable: true },
        at: { kind: "timestamptz", nullable: true },
        custom: { kind: "jsonb", nullable: false },
    },
}

const refusal = (run: () => unknown): string | null => {
    try {
        run()
        return null
    } catch (error) {
        return error instanceof EntityRenderError ? error.code : "other"
    }
}

describe("quoting", () => {
    it("quotes generated identifiers and refuses others", () => {
        expect(quoteIdent("records_sales_lead")).toBe('"records_sales_lead"')
        expect(refusal(() => quoteIdent('x"; drop table y; --'))).toBe("ENTITY_RENDER_NAME_INVALID")
        expect(refusal(() => quoteIdent("Upper"))).toBe("ENTITY_RENDER_NAME_INVALID")
        expect(refusal(() => quoteIdent("a".repeat(64)))).toBe("ENTITY_RENDER_NAME_INVALID")
    })

    it("escapes literals and refuses control characters", () => {
        expect(quoteLiteral("it's")).toBe("'it''s'")
        expect(quoteLiteral("a\\b")).toBe("'a\\b'")
        expect(refusal(() => quoteLiteral("a\u0000b"))).toBe("ENTITY_RENDER_VALUE_INVALID")
    })

    it("accepts only plain data keys", () => {
        expect(dataKey("contactName")).toBe("contactName")
        expect(refusal(() => dataKey("a'b"))).toBe("ENTITY_RENDER_NAME_INVALID")
        expect(refusal(() => dataKey("1a"))).toBe("ENTITY_RENDER_NAME_INVALID")
    })
})

describe("expressions", () => {
    it("reads text, json and typed fields from data and system fields from columns", () => {
        expect(textOf("name")).toBe("(data->>'name')")
        expect(jsonOf("custom")).toBe("(data->'custom')")
        expect(exprOf(entity, "name")).toBe("(data->>'name')")
        expect(exprOf(entity, "age")).toBe("((data->>'age')::integer)")
        expect(exprOf(entity, "big")).toBe("((data->>'big')::bigint)")
        expect(exprOf(entity, "paid")).toBe("((data->>'paid')::boolean)")
        expect(exprOf(entity, "owner")).toBe("((data->>'owner')::uuid)")
        expect(exprOf(entity, "at")).toBe("(data->>'at')")
        expect(exprOf(entity, "custom")).toBe("(data->'custom')")
        expect(exprOf(entity, "updatedAt")).toBe("updated_at")
        expect(refusal(() => exprOf(entity, "ghost"))).toBe("ENTITY_RENDER_NAME_INVALID")
    })

    it("casts a nested key by its kind", () => {
        expect(keyExprOf("custom", "tier", "int")).toBe("((data->'custom'->>'tier')::integer)")
        expect(keyExprOf("custom", "label", "text")).toBe("(data->'custom'->>'label')")
    })
})

describe("filterSql", () => {
    const sql = (filter: Parameters<typeof filterSql>[1]) => filterSql(entity, filter)

    it("renders comparisons against values, fields and null", () => {
        expect(sql({ op: "eq", field: "name", value: "o'k" })).toBe("(data->>'name') = 'o''k'")
        expect(sql({ op: "gte", field: "age", value: 18 })).toBe("((data->>'age')::integer) >= 18")
        expect(sql({ op: "ne", field: "paid", value: true })).toBe("((data->>'paid')::boolean) <> TRUE")
        expect(sql({ op: "lt", field: "age", ref: "big" })).toBe("((data->>'age')::integer) < ((data->>'big')::bigint)")
        expect(sql({ op: "eq", field: "name", value: null })).toBe("(data->>'name') IS NULL")
        expect(sql({ op: "ne", field: "name", value: null })).toBe("(data->>'name') IS NOT NULL")
        expect(sql({ op: "eq", field: "paid", value: false })).toBe("((data->>'paid')::boolean) = FALSE")
        expect(sql({ op: "gt", field: "age" })).toBe("((data->>'age')::integer) > NULL")
        expect(refusal(() => sql({ op: "eq", field: "age", value: Number.NaN }))).toBe("ENTITY_RENDER_VALUE_INVALID")
    })

    it("renders lists, nulls, search and overlap", () => {
        expect(sql({ op: "in", field: "name", values: ["a", "b"] })).toBe("(data->>'name') IN ('a', 'b')")
        expect(sql({ op: "notIn", field: "age", values: [1] })).toBe("((data->>'age')::integer) NOT IN (1)")
        expect(refusal(() => sql({ op: "in", field: "name", values: [] }))).toBe("ENTITY_RENDER_VALUE_INVALID")
        expect(refusal(() => sql({ op: "in", field: "age", values: Array.from({ length: 501 }, () => 1) }))).toBe(
            "ENTITY_RENDER_VALUE_INVALID",
        )
        expect(sql({ op: "isNull", field: "owner" })).toBe("((data->>'owner')::uuid) IS NULL")
        expect(sql({ op: "notNull", field: "owner" })).toBe("((data->>'owner')::uuid) IS NOT NULL")
        expect(sql({ op: "search", fields: ["name"], text: "50%_x" })).toBe(
            "(public.knowledge_fold((data->>'name')) LIKE public.knowledge_fold('%50\\%\\_x%'))",
        )
        expect(refusal(() => sql({ op: "search", fields: [], text: "x" }))).toBe("ENTITY_RENDER_VALUE_INVALID")
        expect(refusal(() => sql({ op: "search", fields: ["name"], text: "x".repeat(201) }))).toBe(
            "ENTITY_RENDER_VALUE_INVALID",
        )
        expect(
            sql({ op: "overlaps", range: ["at", "at"], from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" }),
        ).toContain(
            "tstzrange(public.engine_ts((data->>'at')), public.engine_ts((data->>'at'))) && tstzrange('2026-01-01T00:00:00Z'::timestamptz",
        )
    })

    it("renders and, or, not and refuses has and an empty or wide group", () => {
        const notNull: FilterExpr = { op: "notNull", field: "name" }
        expect(sql({ op: "and", of: [notNull, notNull] })).toBe(
            "((data->>'name') IS NOT NULL AND (data->>'name') IS NOT NULL)",
        )
        expect(sql({ op: "or", of: [notNull] })).toBe("((data->>'name') IS NOT NULL)")
        expect(sql({ op: "not", of: notNull })).toBe("(NOT (data->>'name') IS NOT NULL)")
        expect(refusal(() => sql({ op: "has", relation: "x" }))).toBe("ENTITY_RENDER_OP_UNSUPPORTED")
        expect(refusal(() => sql({ op: "and", of: [] }))).toBe("ENTITY_RENDER_VALUE_INVALID")
        expect(refusal(() => sql({ op: "or", of: Array.from({ length: 33 }, () => notNull) }))).toBe(
            "ENTITY_RENDER_VALUE_INVALID",
        )
    })
})
