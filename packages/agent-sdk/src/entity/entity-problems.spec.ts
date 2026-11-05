import { z } from "zod"
import type { Namespaced } from "../schema/schema.types"
import { defineEntity, field } from "./entity"
import type { AnyEntityDefinition } from "./entity-any.types"
import { entityLocalProblems, entityProblems, filterFieldsOf } from "./entity-problems"
import type { EntityProblemCode, FieldDef, RelationDef } from "./entity.types"

const base = defineEntity({
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: {
        phone: field.text({ maxLength: 30, nullable: true }),
        data: field.jsonb({ shape: z.object({}), keys: { tier: { kind: "text", filter: true } } }),
    },
})

const order = defineEntity({ name: "sales.order", dataKind: "order", fields: { code: field.text({ maxLength: 10 }) } })

const catalog = new Map<string, AnyEntityDefinition>([
    [base.name, base],
    [order.name, order],
])

/** The codes of the problems of `base` patched with `patch`. */
const codes = (patch: Partial<AnyEntityDefinition>, known = catalog): ReadonlyArray<EntityProblemCode> =>
    entityProblems({ ...base, ...patch }, known).map((problem) => problem.code)

const withField = (name: string, declared: FieldDef): Partial<AnyEntityDefinition> => ({
    fields: { ...base.fields, [name]: declared },
})

const toOne = (target: Namespaced): Record<string, RelationDef> => ({ x: { kind: "toOne", target } })

describe("entityProblems", () => {
    it("accepts a sound declaration, relations to known targets and a self relation", () => {
        expect(entityProblems(base, catalog)).toEqual([])
        expect(
            codes({
                relations: {
                    order: { kind: "toOne", target: "sales.order", required: true },
                    self: { kind: "toMany", target: "sales.lead" },
                },
                projection: { sources: ["sales.order", "sales.lead"] },
            }),
        ).toEqual([])
    })

    it("reports an invalid entity name", () => {
        expect(codes({ name: "Sales.Lead" })).toEqual(["ENTITY_NAME_INVALID"])
    })

    it("reports reserved and malformed field names", () => {
        expect(codes(withField("version", field.int()))).toEqual(["ENTITY_FIELD_RESERVED"])
        expect(codes(withField("id", field.int()))).toEqual(["ENTITY_FIELD_RESERVED"])
        expect(codes(withField("Bad_name", field.int()))).toEqual(["ENTITY_FIELD_NAME_INVALID"])
        expect(codes(withField("goodName2", field.int()))).toEqual([])
    })

    it("reports an unknown relation target", () => {
        expect(codes({ relations: toOne("sales.ghost") })).toEqual(["ENTITY_RELATION_TARGET_UNKNOWN"])
        expect(codes({ relations: toOne("sales.order") })).toEqual([])
    })

    it("reports indexes on unknown fields, partial filters and nested keys, and accepts system fields", () => {
        expect(codes({ indexes: [{ name: "a", on: ["ghost"] }] })).toEqual(["ENTITY_INDEX_FIELD_UNKNOWN"])
        expect(codes({ indexes: [{ name: "a", on: [{ fold: "ghost" }, { desc: "ghost" }] }] })).toEqual([
            "ENTITY_INDEX_FIELD_UNKNOWN",
            "ENTITY_INDEX_FIELD_UNKNOWN",
        ])
        expect(codes({ indexes: [{ name: "a", on: ["phone"], where: { op: "notNull", field: "ghost" } }] })).toEqual([
            "ENTITY_INDEX_FIELD_UNKNOWN",
        ])
        expect(codes({ indexes: [{ name: "a", on: [{ key: ["ghost", "tier"] }] }] })).toEqual([
            "ENTITY_INDEX_FIELD_UNKNOWN",
        ])
        expect(codes({ indexes: [{ name: "a", on: [{ key: ["data", "ghost"] }] }] })).toEqual([
            "ENTITY_CUSTOM_KEY_INVALID",
        ])
        expect(
            codes({
                indexes: [
                    {
                        name: "a",
                        on: [{ key: ["data", "tier"] }, "phone", { desc: "updatedAt" }, { desc: "id" }],
                        where: { op: "notNull", field: "data.tier" },
                    },
                ],
            }),
        ).toEqual([])
    })

    it("reports constraints and match keys on unknown fields", () => {
        expect(codes({ constraints: [{ kind: "unique", name: "u", on: ["ghost"], refusal: "r" }] })).toEqual([
            "ENTITY_CONSTRAINT_FIELD_UNKNOWN",
        ])
        expect(
            codes({
                constraints: [
                    { kind: "unique", name: "u", on: ["phone"], where: { op: "isNull", field: "ghost" }, refusal: "r" },
                ],
            }),
        ).toEqual(["ENTITY_CONSTRAINT_FIELD_UNKNOWN"])
        expect(
            codes({
                constraints: [
                    { kind: "check", name: "c", expr: { op: "gt", field: "ghost", ref: "phone" }, refusal: "r" },
                ],
            }),
        ).toEqual(["ENTITY_CONSTRAINT_FIELD_UNKNOWN"])
        expect(
            codes({
                constraints: [
                    {
                        kind: "noOverlap",
                        name: "n",
                        equal: ["ghost"],
                        range: ["phone", "createdAt"],
                        where: { op: "notNull", field: "phone" },
                        refusal: "r",
                    },
                ],
            }),
        ).toEqual(["ENTITY_CONSTRAINT_FIELD_UNKNOWN"])
        expect(
            codes({
                constraints: [
                    { kind: "noOverlap", name: "n", equal: ["phone"], range: ["phone", "createdAt"], refusal: "r" },
                ],
            }),
        ).toEqual([])
        expect(codes({ matchKeys: [{ name: "m", on: ["ghost"] }] })).toEqual(["ENTITY_MATCH_KEY_FIELD_UNKNOWN"])
        expect(codes({ matchKeys: [{ name: "m", on: ["data.tier"] }] })).toEqual([])
        expect(codes({ matchKeys: [{ name: "m", on: ["ghost.tier"] }] })).toEqual(["ENTITY_MATCH_KEY_FIELD_UNKNOWN"])
        const bare = field.jsonb({ shape: z.object({}) })
        expect(codes({ ...withField("bare", bare), matchKeys: [{ name: "m", on: ["bare.tier"] }] })).toEqual([
            "ENTITY_MATCH_KEY_FIELD_UNKNOWN",
        ])
    })

    it("reports text without a usable bound", () => {
        const text = (maxLength?: number): FieldDef => ({
            kind: "text",
            nullable: false,
            ...(maxLength === undefined ? {} : { maxLength }),
        })
        expect(codes(withField("t", text()))).toEqual(["ENTITY_TEXT_UNBOUNDED"])
        expect(codes(withField("t", text(0)))).toEqual(["ENTITY_TEXT_UNBOUNDED"])
        expect(codes(withField("t", text(1.5)))).toEqual(["ENTITY_TEXT_UNBOUNDED"])
    })

    it("reports an enum without values", () => {
        expect(codes(withField("e", { kind: "enum", nullable: false }))).toEqual(["ENTITY_ENUM_EMPTY"])
    })

    it("reports a sequence declaration that is absent, unparsable or inconsistent with its reset", () => {
        expect(codes(withField("s", field.sequence({ format: "DH" })))).toEqual(["ENTITY_SEQUENCE_FORMAT_INVALID"])
        expect(codes(withField("s", { kind: "sequence", nullable: false }))).toEqual(["ENTITY_SEQUENCE_FORMAT_INVALID"])
        expect(codes(withField("s", field.sequence({ format: "DH-{n:4}", resets: "day" })))).toEqual([
            "ENTITY_SEQUENCE_FORMAT_INVALID",
        ])
        expect(codes(withField("s", field.sequence({ format: "DH-{yyyy}{mm}{dd}-{n:4}", resets: "day" })))).toEqual([])
    })

    it("reports jsonb without a shape and nested keys that are invalid", () => {
        const json = field.jsonb({ shape: z.object({}) })
        expect(codes(withField("j", { kind: "jsonb", nullable: false }))).toEqual(["ENTITY_JSONB_SHAPE_MISSING"])
        expect(codes(withField("j", { ...json, keys: { "bad key": { kind: "text" } } }))).toEqual([
            "ENTITY_CUSTOM_KEY_INVALID",
        ])
        expect(codes(withField("j", { ...json, keys: { good: { kind: "int", sort: true } } }))).toEqual([])
        const text = field.text({ maxLength: 5 })
        expect(codes(withField("t", { ...text, keys: { a: { kind: "text" } } }))).toEqual(["ENTITY_CUSTOM_KEY_INVALID"])
        expect(codes(withField("t", { ...text, freeKeys: true }))).toEqual(["ENTITY_CUSTOM_KEY_INVALID"])
    })

    it("reports a projection source outside the catalog", () => {
        expect(codes({ projection: { sources: ["sales.ghost"] } })).toEqual(["ENTITY_PROJECTION_SOURCE_UNKNOWN"])
    })

    it("reports a partition name another entity already maps to", () => {
        const first: AnyEntityDefinition = { ...base, name: "a-b.c" }
        const second: AnyEntityDefinition = { ...base, name: "a.b-c" }
        const both = new Map<string, AnyEntityDefinition>([
            [first.name, first],
            [second.name, second],
        ])
        expect(entityProblems(second, both).map((problem) => problem.code)).toEqual(["ENTITY_PARTITION_NAME_TAKEN"])
        expect(entityProblems(first, new Map([[first.name, first]]))).toEqual([])
    })

    it("names the entity and the place of each problem", () => {
        expect(entityProblems({ ...base, indexes: [{ name: "idx", on: ["ghost"] }] }, catalog)).toEqual([
            { code: "ENTITY_INDEX_FIELD_UNKNOWN", entity: "sales.lead", at: "indexes.idx" },
        ])
    })
})

describe("entityLocalProblems", () => {
    it("leaves the relations, projection and partition names to the catalog", () => {
        const loose: AnyEntityDefinition = {
            ...base,
            relations: toOne("sales.ghost"),
            projection: { sources: ["sales.ghost"] },
        }
        expect(entityLocalProblems(loose)).toEqual([])
        expect(entityProblems(loose, catalog).map((problem) => problem.code)).toEqual([
            "ENTITY_RELATION_TARGET_UNKNOWN",
            "ENTITY_PROJECTION_SOURCE_UNKNOWN",
        ])
    })
})

describe("filterFieldsOf", () => {
    it("reads the fields of every operator and nothing from a has", () => {
        expect(
            filterFieldsOf({
                op: "and",
                of: [
                    {
                        op: "or",
                        of: [
                            { op: "eq", field: "a", value: 1 },
                            { op: "lt", field: "b", ref: "c" },
                        ],
                    },
                    { op: "not", of: { op: "in", field: "d", values: [1] } },
                    { op: "search", fields: ["e", "f"], text: "x" },
                    { op: "overlaps", range: ["g", "h"], from: "2026-01-01", to: "2026-02-01" },
                    { op: "has", relation: "r", where: { op: "isNull", field: "zzz" } },
                    { op: "notNull", field: "i" },
                ],
            }),
        ).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i"])
    })
})
