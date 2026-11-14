import { z } from "zod"
import { thrownFailureOf } from "../tests/thrown-failure"
import { defineEntity, field } from "./entity"
import { EntityDefinitionError } from "./entity-error"
import type { EntityConfig, FieldDef, FieldMap } from "./entity.types"

const fields = {
    name: field.text({ maxLength: 120, searchable: true }),
    phone: field.text({ maxLength: 30, nullable: true }),
    stage: field.enum({ of: ["new", "won"], default: { literal: "new" } }),
    visits: field.int({ default: { literal: 0 } }),
    total: field.bigint({ nullable: true }),
    paid: field.bool(),
    owner: field.uuid(),
    amount: field.moneyVnd(),
    due: field.date({ nullable: true }),
    seen: field.timestamptz({ default: "now" }),
    no: field.sequence({ format: "DH-{yyyy}{mm}{dd}-{n:4}", resets: "day" }),
    data: field.jsonb({
        shape: z.object({ tier: z.string().max(10) }),
        keys: { tier: { kind: "text", filter: true } },
    }),
    extra: field.jsonb({ shape: z.object({}), nullable: true, freeKeys: true }),
}

const config = {
    name: "sales.lead",
    dataKind: "sales-lead",
    fields,
    indexes: [{ name: "recent", on: [{ desc: "updatedAt" }, { desc: "id" }] }],
    constraints: [{ kind: "unique", name: "phone", on: ["phone"], refusal: "phone-taken" }],
    matchKeys: [{ name: "byPhone", on: ["phone"] }],
    relations: { order: { kind: "toOne", target: "sales.order", required: true } },
    view: true,
} satisfies EntityConfig<typeof fields>

describe("field builders", () => {
    it("build each kind and its nullability", () => {
        expect(fields.name).toEqual({ kind: "text", nullable: false, maxLength: 120, searchable: true })
        expect(fields.phone.nullable).toBe(true)
        expect(fields.total.nullable).toBe(true)
        expect(fields.paid).toEqual({ kind: "bool", nullable: false })
        expect(fields.owner.kind).toBe("uuid")
        expect(fields.amount.kind).toBe("money_vnd")
        expect(fields.stage.of).toEqual(["new", "won"])
        expect(fields.seen.default).toBe("now")
        expect(fields.no).toEqual({
            kind: "sequence",
            nullable: false,
            format: "DH-{yyyy}{mm}{dd}-{n:4}",
            resets: "day",
        })
        expect(fields.data.keys).toEqual({ tier: { kind: "text", filter: true } })
        expect(fields.extra).toMatchObject({ nullable: true, freeKeys: true })
    })
})

describe("defineEntity", () => {
    it("returns a frozen declaration", () => {
        const lead = defineEntity(config)
        expect(lead.entry).toBe("entity")
        expect(lead.view).toBe(true)
        for (const frozen of [
            lead,
            lead.fields,
            lead.fields.name,
            lead.indexes,
            lead.relations,
            lead.constraints,
            lead.matchKeys,
        ]) {
            expect(Object.isFrozen(frozen)).toBe(true)
        }
    })

    it("tolerates absent optional parts and freezes a projection", () => {
        const book = defineEntity({
            name: "accounting.book-entry",
            dataKind: "book-entry",
            fields: { note: field.text({ maxLength: 10 }) },
            projection: { sources: ["sales.order"] },
        })
        expect(book.indexes).toBeUndefined()
        expect(Object.isFrozen(book.projection)).toBe(true)
    })

    it("refuses a reserved field name and says where", () => {
        const reserved: EntityConfig<FieldMap> = { name: "sales.lead", dataKind: "x", fields: { version: field.int() } }
        expect(() => defineEntity(reserved)).toThrow(EntityDefinitionError)
        expect(thrownFailureOf(() => defineEntity(reserved))).toEqual({ code: "ENTITY_FIELD_RESERVED", at: "sales.lead.fields.version" })
    })

    it("reports every local problem", () => {
        const broken: EntityConfig<FieldMap> = {
            name: "sales.lead",
            dataKind: "x",
            fields: { id: field.int(), Bad_name: field.int() },
        }
        const thrown = (() => {
            try {
                return defineEntity(broken)
            } catch (caught) {
                return caught
            }
        })()
        expect(thrown).toBeInstanceOf(EntityDefinitionError)
        expect(thrown instanceof EntityDefinitionError ? thrown.problems.map((problem) => problem.code) : []).toEqual([
            "ENTITY_FIELD_RESERVED",
            "ENTITY_FIELD_NAME_INVALID",
        ])
    })
})

describe("field builder nullability", () => {
    it("types a field with options and no nullable as not nullable", () => {
        const required: FieldDef<"text", false> = field.text({ maxLength: 10 })
        const requiredEnum: FieldDef<"enum", false> = field.enum({ of: ["a"] })
        const explicit: FieldDef<"text", false> = field.text({ maxLength: 10, nullable: false })
        expect([required.nullable, requiredEnum.nullable, explicit.nullable]).toEqual([false, false, false])
    })

    it("types a field that says nullable: true as nullable", () => {
        const optional: FieldDef<"text", true> = field.text({ maxLength: 10, nullable: true })
        const nullableFlag: true = optional.nullable
        const requiredFlag: false = field.text({ maxLength: 10 }).nullable
        expect([nullableFlag, requiredFlag]).toEqual([true, false])
    })
})
