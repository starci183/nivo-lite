import type { PlanOp, PlanOpKind } from "./catalog.types"
import type { EntityDefinition } from "./entity.types"
import { renderMigration, renderOp } from "./render"

const P = "records_sales_lead"

const lead: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    view: true,
    fields: {
        name: { kind: "text", nullable: false, maxLength: 200 },
        stage: { kind: "enum", nullable: false, of: ["new", "won"] },
    },
    indexes: [{ name: "recent_idx", on: [{ desc: "updatedAt" }] }],
    constraints: [
        { kind: "unique", name: "name_key", on: ["name"], refusal: "taken" },
        { kind: "check", name: "named", expr: { op: "notNull", field: "name" }, refusal: "bad" },
        { kind: "noOverlap", name: "no_overlap", equal: [], range: ["name", "name"], refusal: "overlap" },
    ],
}

const op = (kind: PlanOpKind, object: string, additive = true): PlanOp => ({ kind, object, additive, reason: "why" })
const render = (planned: PlanOp) => renderOp(planned, [lead])
const refusal = (planned: PlanOp): string | null => {
    try {
        render(planned)
        return null
    } catch (error) {
        return error instanceof Error && "code" in error ? String(error.code) : "other"
    }
}

describe("renderOp", () => {
    it("writes extensions into the extensions schema", () => {
        expect(render(op("create_extension", "extension:pg_trgm"))).toEqual([
            'CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions',
        ])
    })

    it("writes row level security, policies and grants of a base table", () => {
        expect(render(op("enable_rls", "public.records"))).toEqual([
            'ALTER TABLE public."records" ENABLE ROW LEVEL SECURITY',
        ])
        expect(render(op("force_rls", "public.records"))).toEqual([
            'ALTER TABLE public."records" FORCE ROW LEVEL SECURITY',
        ])
        expect(refusal(op("enable_rls", `public.${P}`))).toBe("ENTITY_RENDER_OP_UNSUPPORTED")
        const policy = (command: string) =>
            render(op("create_policy", `public.records:policy:records_app_engine_${command}`))[0]
        expect(policy("select")).toBe(
            'CREATE POLICY "records_app_engine_select" ON public."records" FOR SELECT TO app_engine USING (workspace_id = public.engine_workspace())',
        )
        expect(policy("insert")).toBe(
            'CREATE POLICY "records_app_engine_insert" ON public."records" FOR INSERT TO app_engine WITH CHECK (workspace_id = public.engine_workspace())',
        )
        expect(policy("update")).toContain("USING (workspace_id = public.engine_workspace()) WITH CHECK (")
        expect(render(op("alter_policy", "public.records:policy:records_app_engine_delete", false))[0]).toBe(
            'DROP POLICY "records_app_engine_delete" ON public."records"',
        )
        expect(refusal(op("create_policy", "public.records:policy:other"))).toBe("ENTITY_RENDER_OP_UNSUPPORTED")
        expect(render(op("grant", "public.records:grant:app_engine"))).toEqual([
            'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."records" TO app_engine',
        ])
        expect(render(op("revoke", "public.records:grant:app_engine", false))).toEqual([
            'REVOKE ALL ON TABLE public."records" FROM app_engine',
            'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."records" TO app_engine',
        ])
    })

    it("writes the partition, its checks, excludes and indexes", () => {
        expect(render(op("create_partition", `public.${P}`))).toEqual([
            `CREATE TABLE public."${P}" PARTITION OF public.records FOR VALUES IN ('sales.lead')`,
        ])
        expect(render(op("add_check", `public.${P}:constraint:${P}_stage_chk`))).toHaveLength(2)
        expect(render(op("replace_check", `public.${P}:constraint:${P}_stage_chk`))[0]).toBe(
            `ALTER TABLE public."${P}" DROP CONSTRAINT "${P}_stage_chk"`,
        )
        expect(render(op("narrow_check", `public.${P}:constraint:${P}_stage_chk`, false))).toHaveLength(3)
        expect(render(op("validate_constraint", `public.${P}:constraint:${P}_named`))).toEqual([
            `ALTER TABLE public."${P}" VALIDATE CONSTRAINT "${P}_named"`,
        ])
        expect(render(op("add_exclude", `public.${P}:constraint:${P}_no_overlap`))[0]).toContain("EXCLUDE USING gist")
        expect(render(op("add_check", `public.${P}:constraint:${P}_agent_scope_chk`))).toEqual([
            `ALTER TABLE public."${P}" ADD CONSTRAINT "${P}_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID`,
            `ALTER TABLE public."${P}" VALIDATE CONSTRAINT "${P}_agent_scope_chk"`,
        ])
        const agentFk = [
            `ALTER TABLE public."${P}" ADD CONSTRAINT "${P}_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID`,
            `ALTER TABLE public."${P}" VALIDATE CONSTRAINT "${P}_agent_fk"`,
        ]
        expect(render(op("add_foreign_key", `public.${P}:constraint:${P}_agent_fk`))).toEqual(agentFk)
        expect(render(op("alter_foreign_key", `public.${P}:constraint:${P}_agent_fk`, false))).toEqual([
            `ALTER TABLE public."${P}" DROP CONSTRAINT "${P}_agent_fk"`,
            ...agentFk,
        ])
        expect(refusal(op("add_foreign_key", `public.${P}:constraint:ghost`))).toBe("ENTITY_RENDER_OP_UNSUPPORTED")
        expect(render(op("create_index", `public.${P}:index:${P}_recent_idx`))[0]).toContain("CREATE INDEX")
        expect(render(op("add_unique", `public.${P}:index:${P}_name_key`))[0]).toContain("CREATE UNIQUE INDEX")
        expect(render(op("alter_index", `public.${P}:index:${P}_recent_idx`, false))[0]).toBe(
            `DROP INDEX public."${P}_recent_idx"`,
        )
        expect(refusal(op("add_check", `public.${P}:constraint:ghost`))).toBe("ENTITY_RENDER_OP_UNSUPPORTED")
        expect(refusal(op("add_check", "public.records_other:constraint:x"))).toBe("ENTITY_RENDER_OP_UNSUPPORTED")
    })

    it("writes views and drops", () => {
        expect(render(op("create_view", `public.v_${P}`))).toHaveLength(2)
        expect(render(op("alter_view", `public.v_${P}`, false))[0]).toBe(`DROP VIEW public."v_${P}"`)
        expect(refusal(op("create_view", "public.v_records_other"))).toBe("ENTITY_RENDER_OP_UNSUPPORTED")
        expect(renderOp(op("create_view", `public.v_${P}`), [{ ...lead, fields: {}, constraints: [] }])).toHaveLength(2)
        const plain: EntityDefinition = { entry: "entity", name: "sales.lead", dataKind: "sales-lead", fields: {} }
        expect(() => renderOp(op("create_view", `public.v_${P}`), [plain])).toThrow("ENTITY_RENDER_OP_UNSUPPORTED")
        expect(render(op("drop_view", "public.v_records_old", false))).toEqual(['DROP VIEW public."v_records_old"'])
        expect(render(op("drop_partition", "public.records_old", false))).toEqual([
            'ALTER TABLE public.records DETACH PARTITION public."records_old"',
            'DROP TABLE public."records_old"',
        ])
        expect(render(op("drop_index", "public.records_old:index:records_old_x", false))).toEqual([
            'DROP INDEX public."records_old_x"',
        ])
        expect(render(op("drop_constraint", "public.records_old:constraint:records_old_c", false))).toEqual([
            'ALTER TABLE public."records_old" DROP CONSTRAINT "records_old_c"',
        ])
    })

    it("refuses what needs a person", () => {
        expect(refusal(op("base_missing", "public.records", false))).toBe("ENTITY_RENDER_OP_UNSUPPORTED")
        expect(refusal(op("declaration_mismatch", `public.${P}`, false))).toBe("ENTITY_RENDER_OP_UNSUPPORTED")
        expect(refusal(op("create_partition", "public.records_other"))).toBe("ENTITY_RENDER_OP_UNSUPPORTED")
        expect(refusal(op("drop_index", 'public.x:index:bad"name', false))).toBe("ENTITY_RENDER_NAME_INVALID")
    })
})

describe("renderMigration", () => {
    const ops = [op("create_extension", "extension:pg_trgm"), op("create_partition", `public.${P}`)]

    it("writes one commented block per step with no transaction control", () => {
        const result = renderMigration(ops, [lead], "20261112000300")
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.file).toBe("20261112000300_entity-engine-partitions.sql")
        expect(result.sql).toContain("-- create_extension extension:pg_trgm: why\nCREATE EXTENSION")
        expect(result.sql).toContain(`FOR VALUES IN ('sales.lead');\n`)
        expect(result.sql).not.toMatch(/\b(BEGIN|COMMIT)\b/)
        expect(result.sql.endsWith(";\n")).toBe(true)
    })

    it("flattens a reason with a line break into one comment line", () => {
        const step: PlanOp = { kind: "create_extension", object: "extension:pg_trgm", additive: true, reason: "a\nb" }
        const result = renderMigration([step], [lead], "20261112000300")
        expect(result.ok && result.sql.includes("pg_trgm: a b\n")).toBe(true)
    })

    it("refuses a bad stamp and an empty plan", () => {
        expect(renderMigration(ops, [lead], "123")).toEqual({
            ok: false,
            problems: [{ object: "123", code: "ENTITY_RENDER_STAMP_INVALID" }],
        })
        expect(renderMigration([], [lead], "20261112000300")).toEqual({
            ok: false,
            problems: [{ object: "plan", code: "ENTITY_RENDER_EMPTY" }],
        })
    })

    it("refuses a destructive step unless it is a contract migration, then names the file for it", () => {
        const drop = op("drop_partition", "public.records_old", false)
        expect(renderMigration([drop], [lead], "20261112000300")).toEqual({
            ok: false,
            problems: [{ object: "public.records_old", code: "ENTITY_RENDER_DESTRUCTIVE" }],
        })
        const contract = renderMigration([drop], [lead], "20261112000300", { contract: true })
        expect(contract.ok && contract.file).toBe("20261112000300_entity-engine-partitions_contract_drop.sql")
    })

    it("lists every step it cannot write and rethrows what is not a render refusal", () => {
        const bad = renderMigration(
            [op("base_missing", "public.records", false), op("add_check", `public.${P}:constraint:ghost`)],
            [lead],
            "20261112000300",
            { contract: true },
        )
        expect(bad).toEqual({
            ok: false,
            problems: [
                { object: "public.records", code: "ENTITY_RENDER_OP_UNSUPPORTED" },
                { object: `public.${P}:constraint:ghost`, code: "ENTITY_RENDER_OP_UNSUPPORTED" },
            ],
        })
        const hostile: EntityDefinition = {
            ...lead,
            get fields(): EntityDefinition["fields"] {
                return Object.fromEntries(new Array<never>(-1))
            },
        }
        expect(() =>
            renderMigration([op("add_check", `public.${P}:constraint:${P}_stage_chk`)], [hostile], "20261112000300"),
        ).toThrow(RangeError)
    })
})
