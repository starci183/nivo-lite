import { z } from "zod"
import { defineEntity, field } from "./entity"
import { entityLocalProblems, entityProblems, filterFieldsOf } from "./entity-problems"
import type { Namespaced } from "../schema/schema.types"
import type { AnyEntityDefinition } from "./entity-any.types"
import type { EntityProblemCode, FieldDef, RelationDef } from "./entity.types"

const base = defineEntity({
    name: "sales.lead",
    dataKind: "sales-lead",
    table: { schema: "public", name: "leads" },
    ownership: { workspace: "workspaceId" },
    key: "id",
    fields: {
        id: field.uuid({ column: "id" }),
        workspaceId: field.uuid({ column: "workspace_id" }),
        orderId: field.uuid({ column: "order_id", nullable: true }),
        phone: field.text({ column: "phone", maxLength: 30, nullable: true }),
        data: field.jsonb({ column: "data", shape: z.object({}), keys: { tier: { kind: "text", filter: true } } }),
        updatedAt: field.timestamptz({ column: "updated_at" }),
    },
})

const order = defineEntity({
    name: "sales.order",
    dataKind: "order",
    table: { schema: "public", name: "orders" },
    ownership: { workspace: "workspaceId" },
    key: "id",
    fields: {
        id: field.uuid({ column: "id" }),
        workspaceId: field.uuid({ column: "workspace_id" }),
        leadId: field.uuid({ column: "lead_id" }),
        updatedAt: field.timestamptz({ column: "updated_at" }),
    },
})

const catalog = new Map<string, AnyEntityDefinition>([[order.name, order]])

const codesIn = (
    entity: AnyEntityDefinition,
    known: ReadonlyMap<string, AnyEntityDefinition>,
): ReadonlyArray<EntityProblemCode> => entityProblems(entity, known).map((problem) => problem.code)

/** The codes of the problems of `base` patched with `patch`. */
const codes = (patch: Partial<AnyEntityDefinition>): ReadonlyArray<EntityProblemCode> =>
    codesIn({ ...base, ...patch }, catalog)

const withField = (name: string, declared: FieldDef): Partial<AnyEntityDefinition> => ({
    fields: { ...base.fields, [name]: declared },
})

const toOne = (target: Namespaced, via: string): Record<string, RelationDef> => ({ x: { kind: "toOne", target, via } })

describe("entityProblems", () => {
    it("accepts a sound declaration and relations inside one workspace", () => {
        expect(entityProblems(base, catalog)).toEqual([])
        expect(
            codes({
                relations: {
                    order: { kind: "toOne", target: "sales.order", via: "orderId" },
                    orders: { kind: "toMany", target: "sales.order", via: "leadId" },
                    self: { kind: "toOne", target: "sales.lead", via: "orderId" },
                },
                projection: { sources: ["sales.order", "sales.lead"] },
            }),
        ).toEqual([])
    })

    it("reports a missing workspace, key and version field", () => {
        const rest = Object.fromEntries(Object.entries(base.fields).filter(([name]) => name === "phone"))
        expect(codes({ fields: rest })).toEqual([
            "ENTITY_WORKSPACE_FIELD_MISSING",
            "ENTITY_KEY_FIELD_MISSING",
            "ENTITY_VERSION_FIELD_MISSING",
        ])
    })

    it("reports an unknown relation target and an unknown via field", () => {
        expect(codes({ relations: toOne("sales.ghost", "orderId") })).toEqual(["ENTITY_RELATION_TARGET_UNKNOWN"])
        expect(codes({ relations: toOne("sales.order", "ghost") })).toEqual(["ENTITY_RELATION_TARGET_UNKNOWN"])
        expect(codes({ relations: { x: { kind: "toMany", target: "sales.order", via: "ghost" } } })).toEqual([
            "ENTITY_RELATION_TARGET_UNKNOWN",
        ])
    })

    it("reports a toOne not joined inside one workspace", () => {
        expect(codes({ relations: toOne("sales.order", "workspaceId") })).toEqual([
            "ENTITY_RELATION_NOT_WORKSPACE_JOINED",
        ])
        const text = field.text({ column: "workspace_id", maxLength: 40 })
        expect(codes({ ...withField("workspaceId", text), relations: toOne("sales.order", "orderId") })).toEqual([
            "ENTITY_RELATION_NOT_WORKSPACE_JOINED",
        ])
        const foreign = new Map<string, AnyEntityDefinition>([
            [order.name, { ...order, fields: { ...order.fields, workspaceId: text } }],
        ])
        expect(codesIn({ ...base, relations: toOne("sales.order", "orderId") }, foreign)).toEqual([
            "ENTITY_RELATION_NOT_WORKSPACE_JOINED",
        ])
    })

    it("reports indexes on unknown fields, partial filters and custom keys", () => {
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
                        on: [{ key: ["data", "tier"] }, "phone"],
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
                        range: ["phone", "updatedAt"],
                        where: { op: "notNull", field: "phone" },
                        refusal: "r",
                    },
                ],
            }),
        ).toEqual(["ENTITY_CONSTRAINT_FIELD_UNKNOWN"])
        expect(
            codes({
                constraints: [
                    { kind: "noOverlap", name: "n", equal: ["phone"], range: ["phone", "updatedAt"], refusal: "r" },
                ],
            }),
        ).toEqual([])
        expect(codes({ matchKeys: [{ name: "m", on: ["ghost"] }] })).toEqual(["ENTITY_MATCH_KEY_FIELD_UNKNOWN"])
        expect(codes({ matchKeys: [{ name: "m", on: ["data.tier"] }] })).toEqual([])
        expect(codes({ matchKeys: [{ name: "m", on: ["ghost.tier"] }] })).toEqual(["ENTITY_MATCH_KEY_FIELD_UNKNOWN"])
        const bare = field.jsonb({ column: "b", shape: z.object({}) })
        expect(codes({ ...withField("bare", bare), matchKeys: [{ name: "m", on: ["bare.tier"] }] })).toEqual([
            "ENTITY_MATCH_KEY_FIELD_UNKNOWN",
        ])
    })

    it("reports a duplicate column", () => {
        expect(codes(withField("other", field.text({ column: "phone", maxLength: 5 })))).toEqual([
            "ENTITY_COLUMN_DUPLICATE",
        ])
    })

    it("reports text without a usable bound", () => {
        const text = (maxLength?: number): FieldDef => ({
            kind: "text",
            column: "t",
            nullable: false,
            ...(maxLength === undefined ? {} : { maxLength }),
        })
        expect(codes(withField("t", text()))).toEqual(["ENTITY_TEXT_UNBOUNDED"])
        expect(codes(withField("t", text(0)))).toEqual(["ENTITY_TEXT_UNBOUNDED"])
        expect(codes(withField("t", text(1.5)))).toEqual(["ENTITY_TEXT_UNBOUNDED"])
    })

    it("reports an enum without values", () => {
        expect(codes(withField("e", { kind: "enum", column: "e", nullable: false }))).toEqual(["ENTITY_ENUM_EMPTY"])
    })

    it("reports a sequence format that is absent or invalid", () => {
        expect(codes(withField("s", field.sequence({ column: "s", format: "DH" })))).toEqual([
            "ENTITY_SEQUENCE_FORMAT_INVALID",
        ])
        expect(codes(withField("s", { kind: "sequence", column: "s", nullable: false }))).toEqual([
            "ENTITY_SEQUENCE_FORMAT_INVALID",
        ])
    })

    it("reports jsonb without a shape and custom keys that are invalid", () => {
        const json = field.jsonb({ column: "j", shape: z.object({}) })
        expect(codes(withField("j", { kind: "jsonb", column: "j", nullable: false }))).toEqual([
            "ENTITY_JSONB_SHAPE_MISSING",
        ])
        expect(codes(withField("j", { ...json, keys: { "bad key": { kind: "text" } } }))).toEqual([
            "ENTITY_CUSTOM_KEY_INVALID",
        ])
        expect(codes(withField("j", { ...json, keys: { good: { kind: "int", sort: true } } }))).toEqual([])
        const text = field.text({ column: "t", maxLength: 5 })
        expect(codes(withField("t", { ...text, keys: { a: { kind: "text" } } }))).toEqual(["ENTITY_CUSTOM_KEY_INVALID"])
        expect(codes(withField("t", { ...text, freeKeys: true }))).toEqual(["ENTITY_CUSTOM_KEY_INVALID"])
    })

    it("reports a projection source outside the catalog", () => {
        expect(codes({ projection: { sources: ["sales.ghost"] } })).toEqual(["ENTITY_PROJECTION_SOURCE_UNKNOWN"])
    })

    it("names the entity and the place of each problem", () => {
        expect(entityProblems({ ...base, indexes: [{ name: "idx", on: ["ghost"] }] }, catalog)).toEqual([
            { code: "ENTITY_INDEX_FIELD_UNKNOWN", entity: "sales.lead", at: "indexes.idx" },
        ])
    })
})

describe("entityLocalProblems", () => {
    it("leaves the relations and projection to the catalog", () => {
        const loose: AnyEntityDefinition = {
            ...base,
            relations: toOne("sales.ghost", "orderId"),
            projection: { sources: ["sales.ghost"] },
        }
        expect(entityLocalProblems(loose)).toEqual([])
        expect(codesIn(loose, catalog)).toEqual(["ENTITY_RELATION_TARGET_UNKNOWN", "ENTITY_PROJECTION_SOURCE_UNKNOWN"])
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
