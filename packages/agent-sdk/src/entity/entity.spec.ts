import { z } from "zod"
import { DEFAULT_VERSION_FIELD, defineEntity, field } from "./entity"
import { EntityDefinitionError } from "./entity-error"
import type { EntityConfig, FieldMap } from "./entity.types"

const fields = {
    id: field.uuid({ column: "id", generated: "db", default: "uuid" }),
    workspaceId: field.uuid({ column: "workspace_id" }),
    name: field.text({ column: "name", maxLength: 120, searchable: true }),
    phone: field.text({ column: "phone", maxLength: 30, nullable: true }),
    stage: field.enum({ column: "stage", of: ["new", "won"], default: { literal: "new" } }),
    visits: field.int({ column: "visits", default: { literal: 0 } }),
    total: field.bigint({ column: "total", nullable: true }),
    paid: field.bool({ column: "paid" }),
    amount: field.moneyVnd({ column: "amount" }),
    due: field.date({ column: "due", nullable: true }),
    no: field.sequence({ column: "no", format: "DH-{yyyy}-{n:5}" }),
    data: field.jsonb({
        column: "data",
        shape: z.object({ tier: z.string().max(10) }),
        keys: { tier: { kind: "text", filter: true } },
    }),
    extra: field.jsonb({ column: "extra", shape: z.object({}), nullable: true, freeKeys: true }),
    createdAt: field.timestamptz({ column: "created_at", generated: "db", default: "now" }),
    updatedAt: field.timestamptz({ column: "updated_at", generated: "db", default: "now" }),
}

const config = {
    name: "sales.lead",
    dataKind: "sales-lead",
    table: { schema: "public", name: "leads" },
    ownership: { workspace: "workspaceId" },
    fields,
    key: "id",
    indexes: [{ name: "leads_recent", on: ["workspaceId", { desc: "updatedAt" }, { desc: "id" }] }],
    constraints: [{ kind: "unique", name: "leads_phone", on: ["workspaceId", "phone"], refusal: "phone-taken" }],
    matchKeys: [{ name: "byPhone", on: ["phone"] }],
    relations: { self: { kind: "toOne", target: "sales.lead", via: "id" } },
    existing: { since: "20261026000000" },
} satisfies EntityConfig<typeof fields>

describe("field builders", () => {
    it("build each kind with its column and nullability", () => {
        expect(fields.id).toEqual({ kind: "uuid", column: "id", nullable: false, generated: "db", default: "uuid" })
        expect(fields.phone).toEqual({ kind: "text", column: "phone", nullable: true, maxLength: 30 })
        expect(fields.total.nullable).toBe(true)
        expect(fields.amount.kind).toBe("money_vnd")
        expect(fields.stage.of).toEqual(["new", "won"])
        expect(fields.no).toMatchObject({ kind: "sequence", nullable: false, format: "DH-{yyyy}-{n:5}" })
        expect(fields.data.keys).toEqual({ tier: { kind: "text", filter: true } })
        expect(fields.extra).toMatchObject({ nullable: true, freeKeys: true })
    })
})

describe("defineEntity", () => {
    it("returns a frozen declaration whose version defaults to updatedAt", () => {
        const lead = defineEntity(config)
        expect(lead.entry).toBe("entity")
        expect(lead.version).toBe(DEFAULT_VERSION_FIELD)
        expect(Object.isFrozen(lead)).toBe(true)
        expect(Object.isFrozen(lead.fields)).toBe(true)
        expect(Object.isFrozen(lead.fields.name)).toBe(true)
        expect(Object.isFrozen(lead.indexes)).toBe(true)
        expect(Object.isFrozen(lead.relations)).toBe(true)
        expect(Object.isFrozen(lead.ownership)).toBe(true)
        expect(Object.isFrozen(lead.existing)).toBe(true)
    })

    it("keeps a named version field and tolerates absent optional parts", () => {
        const note = defineEntity({
            name: "sales.note",
            dataKind: "note",
            table: { schema: "public", name: "notes" },
            ownership: { workspace: "workspaceId" },
            key: "id",
            version: "rev",
            fields: {
                id: field.uuid({ column: "id" }),
                workspaceId: field.uuid({ column: "workspace_id" }),
                rev: field.int({ column: "rev" }),
            },
        })
        expect(note.version).toBe("rev")
        expect(note.indexes).toBeUndefined()
    })

    it("refuses a missing version field and says which", () => {
        const noVersion: EntityConfig<FieldMap> = {
            ...config,
            fields: { id: fields.id, workspaceId: fields.workspaceId },
        }
        expect(() => defineEntity(noVersion)).toThrow(EntityDefinitionError)
        expect(() => defineEntity(noVersion)).toThrow("ENTITY_VERSION_FIELD_MISSING: sales.lead.version")
    })

    it("refuses every local problem and reports all of them", () => {
        const broken: EntityConfig<FieldMap> = { ...config, ownership: { workspace: "nope" }, key: "nope2" }
        const thrown = (() => {
            try {
                return defineEntity(broken)
            } catch (caught) {
                return caught
            }
        })()
        expect(thrown).toBeInstanceOf(EntityDefinitionError)
        expect(thrown).toMatchObject({ code: "ENTITY_WORKSPACE_FIELD_MISSING" })
        expect(thrown instanceof EntityDefinitionError ? thrown.problems.map((problem) => problem.code) : []).toEqual([
            "ENTITY_WORKSPACE_FIELD_MISSING",
            "ENTITY_KEY_FIELD_MISSING",
        ])
    })
})
