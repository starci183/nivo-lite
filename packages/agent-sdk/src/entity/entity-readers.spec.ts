import { z } from "zod"
import { field } from "./entity"
import { rowSchemaOf } from "./entity-readers"
import type { AnyEntityDefinition } from "./entity-any.types"
import type { FieldDef } from "./entity.types"

const entityOf = (extra: Record<string, FieldDef>): AnyEntityDefinition => ({
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    table: { schema: "public", name: "leads" },
    ownership: { workspace: "workspaceId" },
    key: "id",
    version: "updatedAt",
    fields: {
        id: field.uuid({ column: "id", generated: "db" }),
        workspaceId: field.uuid({ column: "workspace_id" }),
        updatedAt: field.timestamptz({ column: "updated_at", generated: "db" }),
        ...extra,
    },
})

const ROW = {
    id: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    updatedAt: "2026-11-05T10:00:00.123456+00:00",
}

describe("rowSchemaOf", () => {
    const entity = entityOf({
        name: field.text({ column: "name", maxLength: 5 }),
        note: field.text({ column: "note", maxLength: 50, nullable: true }),
        stage: field.enum({ column: "stage", of: ["new", "won"] }),
        count: field.int({ column: "count" }),
        total: field.bigint({ column: "total" }),
        paid: field.bool({ column: "paid" }),
        due: field.date({ column: "due" }),
        amount: field.moneyVnd({ column: "amount" }),
        no: field.sequence({ column: "no", format: "DH-{n:5}" }),
        data: field.jsonb({ column: "data", shape: z.object({ tag: z.string().max(10) }) }),
    })
    const schema = rowSchemaOf(entity)
    const row = {
        ...ROW,
        name: "Dinh",
        note: null,
        stage: "new",
        count: 3,
        total: "9007199254740993",
        paid: false,
        due: "2026-11-05",
        amount: -1500,
        no: "DH-00001",
        data: { tag: "vip" },
    }

    it("parses a conforming row", () => {
        expect(schema.parse(row)).toEqual(row)
    })

    it("picks a subset", () => {
        expect(schema.pick({ id: true }).parse({ id: ROW.id })).toEqual({ id: ROW.id })
    })

    it.each([
        ["a text over its bound", { name: "toolong" }],
        ["an enum outside its values", { stage: "lost" }],
        ["a non-integer int", { count: 1.5 }],
        ["an int beyond 32 bits", { count: 2147483648 }],
        ["a bigint with letters", { total: "12ab" }],
        ["a bigint over 19 digits", { total: "12345678901234567890" }],
        ["a non-iso timestamp", { updatedAt: "yesterday" }],
        ["a malformed date", { due: "05/11/2026" }],
        ["a null in a non-null field", { name: null }],
        ["a jsonb off its shape", { data: { tag: "x".repeat(11) } }],
        ["an unknown column", { extra: 1 }],
        ["a non-uuid id", { id: "abc" }],
    ])("refuses %s", (_name, patch) => {
        expect(schema.safeParse({ ...row, ...patch }).success).toBe(false)
    })

    it("refuses a declaration the readers cannot bound", () => {
        const unbounded: FieldDef = { kind: "text", column: "x", nullable: false }
        expect(() => rowSchemaOf(entityOf({ x: unbounded }))).toThrow("ENTITY_TEXT_UNBOUNDED: sales.lead.fields.x")
        const noValues: FieldDef = { kind: "enum", column: "x", nullable: false }
        expect(() => rowSchemaOf(entityOf({ x: noValues }))).toThrow("ENTITY_ENUM_EMPTY: sales.lead.fields.x")
        const noShape: FieldDef = { kind: "jsonb", column: "x", nullable: false }
        expect(() => rowSchemaOf(entityOf({ x: noShape }))).toThrow("ENTITY_JSONB_SHAPE_MISSING: sales.lead.fields.x")
    })
})
