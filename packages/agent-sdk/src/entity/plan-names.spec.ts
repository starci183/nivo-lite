import {
    identOf,
    limitOf,
    literalsOf,
    normalizeSql,
    partId,
    partitionNameOf,
    policyNameOf,
    snakeOf,
    tableId,
    typeMatches,
    viewNameOf,
} from "./plan-names"

describe("names", () => {
    it("builds snake case, partition and view names", () => {
        expect(snakeOf("sales.lead")).toBe("sales_lead")
        expect(snakeOf("updatedAt")).toBe("updated_at")
        expect(partitionNameOf("sales.lead-capture")).toBe("records_sales_lead_capture")
        expect(viewNameOf("records_sales_lead")).toBe("v_records_sales_lead")
    })

    it("cuts a long identifier at 63 characters like postgres", () => {
        expect(identOf("x".repeat(70))).toHaveLength(63)
        expect(partitionNameOf(`a.${"b".repeat(80)}`)).toHaveLength(63)
        expect(policyNameOf("t".repeat(70), "delete")).toHaveLength(63)
        expect(policyNameOf("records", "select")).toBe("records_app_engine_select")
    })

    it("builds the ids a plan step carries", () => {
        expect(tableId("records")).toBe("public.records")
        expect(partId("records", "index", "records_x")).toBe("public.records:index:records_x")
    })
})

describe("typeMatches", () => {
    it("accepts the type a kind is cast to, and varying characters for text", () => {
        expect(typeMatches("text", "character varying(80)")).toBe(true)
        expect(typeMatches("text", "text")).toBe(true)
        expect(typeMatches("timestamptz", "timestamp with time zone")).toBe(true)
    })

    it("refuses another type", () => {
        expect(typeMatches("int", "bigint")).toBe(false)
        expect(typeMatches("uuid", "text")).toBe(false)
        expect(typeMatches("int", "character varying")).toBe(false)
    })
})

describe("normalizeSql", () => {
    it("makes two spellings of one expression equal", () => {
        expect(normalizeSql("(((data -> 'custom'::text) ->> 'tier'::text))::integer")).toBe("data->'custom'->>'tier'")
        expect(normalizeSql("public.knowledge_fold(x) public.gin_trgm_ops")).toBe("knowledge_foldx")
        expect(normalizeSql("(workspace_id = engine_workspace())")).toBe(
            normalizeSql("workspace_id = public.engine_workspace()"),
        )
        expect(normalizeSql('"Col"::timestamp with time zone')).toBe("col")
        expect(normalizeSql("x::character varying")).toBe("x")
        expect(normalizeSql("x::text[]")).toBe("x")
    })
})

describe("check definitions", () => {
    it("reads the literals of a CHECK", () => {
        expect(literalsOf("CHECK ((x = ANY (ARRAY['new'::text, 'won'::text])))")).toEqual(["new", "won"])
        expect(literalsOf("CHECK ((length(note) >= 5))")).toEqual([])
    })

    it("reads the length bound of a CHECK", () => {
        expect(limitOf("CHECK ((char_length(x) <= 200))")).toBe(200)
        expect(limitOf("CHECK ((x IS NOT NULL))")).toBeNull()
    })
})
