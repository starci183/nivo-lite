import { z } from "zod"
import { thrownFailureOf } from "../tests/thrown-failure"
import { field } from "./entity"
import type { AnyEntityDefinition } from "./entity-any.types"
import { rowSchemaOf } from "./entity-readers"
import type { FieldDef } from "./entity.types"

const entityOf = (fields: Record<string, FieldDef>): AnyEntityDefinition => ({
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    fields,
})

const SYSTEM = {
    id: "00000000-0000-0000-0000-000000000001",
    workspaceId: "00000000-0000-0000-0000-000000000002",
    version: "7",
    createdAt: "2026-11-05T10:00:00+07:00",
    updatedAt: "2026-11-05T10:00:00.123456+00:00",
}

describe("rowSchemaOf", () => {
    const entity = entityOf({
        name: field.text({ maxLength: 5 }),
        note: field.text({ maxLength: 50, nullable: true }),
        stage: field.enum({ of: ["new", "won"] }),
        count: field.int(),
        total: field.bigint(),
        paid: field.bool(),
        due: field.date(),
        seen: field.timestamptz(),
        owner: field.uuid(),
        amount: field.moneyVnd(),
        no: field.sequence({ format: "DH-{n:5}" }),
        data: field.jsonb({ shape: z.object({ tag: z.string().max(10) }) }),
    })
    const schema = rowSchemaOf(entity)
    const row = {
        ...SYSTEM,
        name: "Dinh",
        note: null,
        stage: "new",
        count: 3,
        total: "9007199254740993",
        paid: false,
        due: "2026-11-05",
        seen: "2026-11-05T10:00:00Z",
        owner: "00000000-0000-0000-0000-000000000003",
        amount: -1500,
        no: "DH-00001",
        data: { tag: "vip" },
    }

    it("parses a conforming row including the system fields", () => {
        expect(schema.parse(row)).toEqual(row)
    })

    it("picks a subset", () => {
        const picked = schema.pick({ id: true, version: true })
        expect(picked.parse({ id: SYSTEM.id, version: "7" })).toEqual({ id: SYSTEM.id, version: "7" })
    })

    it.each([
        ["a text over its bound", { name: "toolong" }],
        ["an enum outside its values", { stage: "lost" }],
        ["a non-integer int", { count: 1.5 }],
        ["an int beyond 32 bits", { count: 2147483648 }],
        ["a bigint with letters", { total: "12ab" }],
        ["a bigint over 19 digits", { total: "12345678901234567890" }],
        ["a non-iso timestamp", { seen: "yesterday" }],
        ["a malformed date", { due: "05/11/2026" }],
        ["a null in a non-null field", { name: null }],
        ["a jsonb off its shape", { data: { tag: "x".repeat(11) } }],
        ["an unknown column", { extra: 1 }],
        ["a non-uuid id", { id: "abc" }],
        ["a negative version", { version: "-1" }],
        ["a version with letters", { version: "1a" }],
        ["a numeric version", { version: 7 }],
    ])("refuses %s", (_name, patch) => {
        expect(schema.safeParse({ ...row, ...patch }).success).toBe(false)
    })

    it("refuses a declaration the readers cannot bound", () => {
        const unbounded: FieldDef = { kind: "text", nullable: false }
        expect(thrownFailureOf(() => rowSchemaOf(entityOf({ x: unbounded })))).toEqual({ code: "ENTITY_TEXT_UNBOUNDED", at: "sales.lead.fields.x" })
        const noValues: FieldDef = { kind: "enum", nullable: false }
        expect(thrownFailureOf(() => rowSchemaOf(entityOf({ x: noValues })))).toEqual({ code: "ENTITY_ENUM_EMPTY", at: "sales.lead.fields.x" })
        const noShape: FieldDef = { kind: "jsonb", nullable: false }
        expect(thrownFailureOf(() => rowSchemaOf(entityOf({ x: noShape })))).toEqual({ code: "ENTITY_JSONB_SHAPE_MISSING", at: "sales.lead.fields.x" })
    })
})
