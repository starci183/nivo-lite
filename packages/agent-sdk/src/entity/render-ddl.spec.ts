import type { EntityDefinition } from "./entity.types"
import { checkPieces, excludePieces, fieldCheckSql, indexPieces, viewPiece } from "./render-ddl"

const P = "records_sales_lead"

const lead: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    view: true,
    fields: {
        name: { kind: "text", nullable: false, maxLength: 200, searchable: true },
        stage: { kind: "enum", nullable: false, of: ["new", "won's"] },
        age: { kind: "int", nullable: true },
        big: { kind: "bigint", nullable: true },
        paid: { kind: "bool", nullable: true },
        owner: { kind: "uuid", nullable: true },
        at: { kind: "timestamptz", nullable: true },
        day: { kind: "date", nullable: true },
        code: { kind: "sequence", nullable: true, format: "DH-{n:5}" },
        free: { kind: "text", nullable: true },
        custom: {
            kind: "jsonb",
            nullable: false,
            freeKeys: true,
            keys: { tier: { kind: "int", filter: true }, label: { kind: "text", sort: true }, quiet: { kind: "text" } },
        },
    },
    indexes: [
        { name: "recent_idx", on: [{ desc: "updatedAt" }, "stage"] },
        {
            name: "fold_idx",
            on: [{ fold: "name" }, { key: ["custom", "tier"] }, { key: ["custom", "ghost"] }],
            using: "gin",
        },
        { name: "part_idx", on: ["age"], unique: true, where: { op: "notNull", field: "age" } },
    ],
    constraints: [
        {
            kind: "unique",
            name: "ws_name_key",
            on: ["name"],
            where: { op: "notNull", field: "name" },
            refusal: "taken",
        },
        { kind: "unique", name: "plain_key", on: ["free"], refusal: "taken" },
        { kind: "check", name: "age_adult", expr: { op: "gte", field: "age", value: 18 }, refusal: "young" },
        {
            kind: "noOverlap",
            name: "no_overlap",
            equal: ["owner"],
            range: ["at", "day"],
            where: { op: "notNull", field: "owner" },
            refusal: "overlap",
        },
        { kind: "noOverlap", name: "plain_overlap", equal: [], range: ["at", "day"], refusal: "overlap" },
    ],
}

const bare: EntityDefinition = { entry: "entity", name: "x.y", dataKind: "xy", fields: {} }

const sqlOf = (
    pieces: ReadonlyArray<{ readonly name: string; readonly statements: ReadonlyArray<string> }>,
    name: string,
) => pieces.find((piece) => piece.name === name)?.statements ?? []

describe("fieldCheckSql", () => {
    it("lets a nullable field be absent or null, and a required one be neither", () => {
        expect(fieldCheckSql("free", { kind: "text", nullable: true })).toBe(
            "(data->>'free') IS NULL OR (jsonb_typeof(data->'free') = 'string')",
        )
        expect(fieldCheckSql("name", { kind: "text", nullable: false, maxLength: 200 })).toBe(
            "(data->>'name') IS NOT NULL AND (jsonb_typeof(data->'name') = 'string' AND char_length((data->>'name')) <= 200)",
        )
    })

    it("types every kind", () => {
        const check = (kind: Parameters<typeof fieldCheckSql>[1]["kind"]) =>
            fieldCheckSql("f", { kind, nullable: false })
        expect(check("int")).toContain("= 'number' AND (data->>'f') ~ '^-?[0-9]{1,10}$'")
        expect(check("bigint")).toContain("{1,19}")
        expect(check("money_vnd")).toContain("{1,19}")
        expect(check("bool")).toContain("= 'boolean'")
        expect(check("uuid")).toContain("[0-9a-f]{8}-")
        expect(check("timestamptz")).toContain("T[0-9:.]+(Z|")
        expect(check("date")).toContain("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
        expect(check("jsonb")).toContain("= 'object'")
        expect(check("sequence")).toContain("= 'string'")
        expect(() => check("enum")).toThrow("ENTITY_RENDER_VALUE_INVALID")
        expect(fieldCheckSql("s", { kind: "enum", nullable: false, of: ["a", "b'c"] })).toContain("IN ('a', 'b''c')")
    })
})

describe("checkPieces", () => {
    it("adds each check NOT VALID and validates it", () => {
        const stage = sqlOf(checkPieces(lead), `${P}_stage_chk`)
        expect(stage).toHaveLength(2)
        expect(stage[0]).toBe(
            `ALTER TABLE public."${P}" ADD CONSTRAINT "${P}_stage_chk" CHECK ((data->>'stage') IS NOT NULL AND ((data->>'stage') IN ('new', 'won''s'))) NOT VALID`,
        )
        expect(stage[1]).toBe(`ALTER TABLE public."${P}" VALIDATE CONSTRAINT "${P}_stage_chk"`)
    })

    it("includes declared checks and none for a bare entity", () => {
        expect(sqlOf(checkPieces(lead), `${P}_age_adult`)[0]).toContain(
            "CHECK (((data->>'age')::integer) >= 18) NOT VALID",
        )
        expect(checkPieces(bare)).toEqual([])
    })
})

describe("excludePieces", () => {
    it("writes an EXCLUDE with the workspace, the equal fields and the range, partial or not", () => {
        const pieces = excludePieces(lead)
        expect(sqlOf(pieces, `${P}_no_overlap`)[0]).toBe(
            `ALTER TABLE public."${P}" ADD CONSTRAINT "${P}_no_overlap" EXCLUDE USING gist (workspace_id WITH =, ((data->>'owner')::uuid) WITH =, tstzrange(public.engine_ts((data->>'at')), public.engine_ts((data->>'day'))) WITH &&) WHERE (((data->>'owner')::uuid) IS NOT NULL)`,
        )
        expect(sqlOf(pieces, `${P}_plain_overlap`)[0]).not.toContain("WHERE")
        expect(excludePieces(bare)).toEqual([])
    })
})

describe("indexPieces", () => {
    const pieces = indexPieces(lead)
    const one = (name: string) => sqlOf(pieces, `${P}_${name}`)[0]

    it("puts the workspace first and reads the parts", () => {
        expect(one("recent_idx")).toBe(
            `CREATE INDEX "${P}_recent_idx" ON public."${P}" USING btree (workspace_id, updated_at DESC, (data->>'stage'))`,
        )
        expect(one("fold_idx")).toContain(
            "USING gin (workspace_id, public.knowledge_fold((data->>'name')), ((data->'custom'->>'tier')::integer), (data->'custom'->>'ghost'))",
        )
        expect(one("part_idx")).toBe(
            `CREATE UNIQUE INDEX "${P}_part_idx" ON public."${P}" USING btree (workspace_id, ((data->>'age')::integer)) WHERE ((data->>'age')::integer) IS NOT NULL`,
        )
    })

    it("turns unique constraints into unique indexes", () => {
        expect(one("ws_name_key")).toContain("CREATE UNIQUE INDEX")
        expect(one("ws_name_key")).toContain("WHERE (data->>'name') IS NOT NULL")
        expect(one("plain_key")).not.toContain("WHERE")
    })

    it("adds trigram, nested key and free key indexes", () => {
        expect(one("name_trgm_idx")).toBe(
            `CREATE INDEX "${P}_name_trgm_idx" ON public."${P}" USING gin (public.knowledge_fold((data->>'name')) extensions.gin_trgm_ops)`,
        )
        expect(one("custom_tier_idx")).toContain("(workspace_id, ((data->'custom'->>'tier')::integer))")
        expect(one("custom_label_idx")).toContain("(workspace_id, (data->'custom'->>'label'))")
        expect(one("custom_quiet_idx")).toBeUndefined()
        expect(one("custom_gin_idx")).toContain("USING gin ((data->'custom'))")
        expect(indexPieces(bare)).toEqual([])
    })
})

describe("viewPiece", () => {
    it("is a security invoker view over the parent, with real types, and a grant", () => {
        const view = viewPiece(lead)
        expect(view?.name).toBe(`v_${P}`)
        expect(view?.statements[0]).toContain(
            `CREATE VIEW public."v_${P}" WITH (security_invoker = true) AS SELECT id, workspace_id, version, created_at, updated_at,`,
        )
        expect(view?.statements[0]).toContain("((data->>'at')::timestamptz) AS \"at\"")
        expect(view?.statements[0]).toContain("((data->>'day')::date) AS \"day\"")
        expect(view?.statements[0]).toContain("((data->>'age')::integer) AS \"age\"")
        expect(view?.statements[0]).toContain("FROM public.records WHERE entity = 'sales.lead'")
        expect(view?.statements[1]).toBe(`GRANT SELECT ON TABLE public."v_${P}" TO app_engine`)
    })

    it("is null without view: true", () => {
        expect(viewPiece(bare)).toBeNull()
    })
})
