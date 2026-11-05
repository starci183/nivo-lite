import type { EntityDefinition } from "./entity.types"
import {
    expectedChecks,
    expectedExcludes,
    expectedIndexes,
    expectedPolicies,
    expectedPrivileges,
    expectedView,
    needsGist,
    needsTrigram,
} from "./plan-expect"

const lead: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    view: true,
    fields: {
        name: { kind: "text", nullable: false, maxLength: 200, searchable: true },
        stage: { kind: "enum", nullable: false, of: ["new", "won"] },
        broken: { kind: "enum", nullable: false },
        free: { kind: "text", nullable: true },
        custom: {
            kind: "jsonb",
            nullable: false,
            freeKeys: true,
            keys: { tier: { kind: "int", filter: true }, rank: { kind: "int", sort: true }, other: { kind: "text" } },
        },
    },
    indexes: [
        { name: "recent_idx", on: [{ desc: "updatedAt" }, { desc: "customerName" }] },
        { name: "fold_idx", on: [{ fold: "name" }, "id", "free"], using: "gin" },
        { name: "tier_idx", on: [{ key: ["custom", "tier"] }], unique: true, where: { op: "notNull", field: "name" } },
    ],
    constraints: [
        { kind: "unique", name: "name_key", on: ["name"], where: { op: "notNull", field: "name" }, refusal: "taken" },
        { kind: "unique", name: "plain_key", on: ["free"], refusal: "taken" },
        { kind: "check", name: "free_set", expr: { op: "notNull", field: "free" }, refusal: "bad" },
        { kind: "noOverlap", name: "no_overlap", equal: [], range: ["a", "b"], refusal: "overlap" },
    ],
}

const bare: EntityDefinition = { entry: "entity", name: "x.y", dataKind: "xy", fields: {} }
const P = "records_sales_lead"

describe("expectedIndexes", () => {
    const all = expectedIndexes(lead)

    it("puts the workspace first in declared indexes and reads system fields as columns", () => {
        expect(all[0]).toEqual({
            name: `${P}_recent_idx`,
            parts: ["workspace_id", "updated_atdesc", "data->>'customername'desc"],
            unique: false,
            method: "btree",
            partial: false,
            constraint: false,
        })
        expect(all[1]).toMatchObject({
            parts: ["workspace_id", "knowledge_folddata->>'name'", "id", "data->>'free'"],
            method: "gin",
        })
        expect(all[2]).toMatchObject({
            parts: ["workspace_id", "data->'custom'->>'tier'"],
            unique: true,
            partial: true,
        })
    })

    it("turns unique constraints into unique indexes, partial or not", () => {
        expect(all[3]).toMatchObject({
            name: `${P}_name_key`,
            parts: ["workspace_id", "data->>'name'"],
            unique: true,
            partial: true,
            constraint: true,
        })
        expect(all[4]).toMatchObject({ name: `${P}_plain_key`, partial: false, constraint: true })
    })

    it("adds trigram, nested key and free key indexes", () => {
        expect(all.slice(5).map((index) => index.name)).toEqual([
            `${P}_name_trgm_idx`,
            `${P}_custom_tier_idx`,
            `${P}_custom_rank_idx`,
            `${P}_custom_gin_idx`,
        ])
        expect(all[6]?.parts).toEqual(["workspace_id", "data->'custom'->>'tier'"])
    })

    it("has none for a bare entity", () => {
        expect(expectedIndexes(bare)).toEqual([])
    })
})

describe("expectedChecks, expectedExcludes", () => {
    it("lists one check per field and each declared check", () => {
        expect(expectedChecks(lead)).toEqual([
            { name: `${P}_name_chk`, key: "name", values: null, limit: 200 },
            { name: `${P}_stage_chk`, key: "stage", values: ["new", "won"], limit: null },
            { name: `${P}_broken_chk`, key: "broken", values: null, limit: null },
            { name: `${P}_free_chk`, key: "free", values: null, limit: null },
            { name: `${P}_custom_chk`, key: "custom", values: null, limit: null },
            { name: `${P}_free_set`, key: null, values: null, limit: null },
        ])
        expect(expectedExcludes(lead)).toEqual([`${P}_no_overlap`])
        expect(expectedChecks(bare)).toEqual([])
        expect(expectedExcludes(bare)).toEqual([])
    })
})

describe("expectedView", () => {
    it("has the system columns then each field, snake cased and typed", () => {
        const view = expectedView(lead)
        expect(view?.name).toBe(`v_${P}`)
        expect(view?.columns.map((column) => `${column.name} ${column.type}`)).toEqual([
            "id uuid",
            "workspace_id uuid",
            "version bigint",
            "created_at timestamp with time zone",
            "updated_at timestamp with time zone",
            "name text",
            "stage text",
            "broken text",
            "free text",
            "custom jsonb",
        ])
    })

    it("is null without view: true", () => {
        expect(expectedView(bare)).toBeNull()
    })
})

describe("expectedPolicies and expectedPrivileges", () => {
    it("scopes every command to the engine workspace", () => {
        const predicate = "workspace_id=engine_workspace"
        expect(expectedPolicies("records")).toEqual([
            { name: "records_app_engine_select", command: "select", qual: predicate, check: null },
            { name: "records_app_engine_insert", command: "insert", qual: null, check: predicate },
            { name: "records_app_engine_update", command: "update", qual: predicate, check: predicate },
            { name: "records_app_engine_delete", command: "delete", qual: predicate, check: null },
        ])
    })

    it("grants delete on records only for a deletable entity, never on sequences", () => {
        const basic = ["select", "insert", "update"]
        expect(expectedPrivileges("records", [lead])).toEqual(basic)
        expect(expectedPrivileges("records", [{ ...lead, deletable: true }])).toEqual([...basic, "delete"])
        expect(expectedPrivileges("record_links", [])).toEqual([...basic, "delete"])
        expect(expectedPrivileges("entity_sequences", [{ ...lead, deletable: true }])).toEqual(basic)
    })
})

describe("extension needs", () => {
    it("knows trigram and gist", () => {
        expect(needsTrigram(lead)).toBe(true)
        expect(needsGist(lead)).toBe(true)
        expect(needsTrigram(bare)).toBe(false)
        expect(needsGist(bare)).toBe(false)
    })
})
