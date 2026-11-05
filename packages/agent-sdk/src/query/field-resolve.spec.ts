import { z } from "zod"
import type { EntityDefinition } from "../entity/entity.types"
import { kindClassOf, ORDERED_CLASSES, resolveField } from "./field-resolve"
import { LEAD, OWNER } from "./query.fixture"

const BLOB: EntityDefinition = {
    ...OWNER,
    fields: {
        ...OWNER.fields,
        blob: {
            kind: "jsonb",
            nullable: false,
            shape: z
                .record(z.string().max(10), z.string().max(10))
                .refine((entries) => Object.keys(entries).length <= 10),
        },
    },
}

describe("resolveField", () => {
    it("resolves a declared field", () => {
        expect(resolveField(LEAD, "channel", "select")).toEqual({
            ok: true,
            field: { kind: "text", nullable: true, custom: false },
        })
        expect(resolveField(LEAD, "contactName", "where")).toEqual({
            ok: true,
            field: { kind: "text", nullable: false, custom: false },
        })
    })

    it("resolves the system fields", () => {
        expect(resolveField(LEAD, "id", "order")).toEqual({
            ok: true,
            field: { kind: "uuid", nullable: false, custom: false },
        })
        expect(resolveField(LEAD, "version", "where")).toEqual({
            ok: true,
            field: { kind: "bigint", nullable: false, custom: false },
        })
        expect(resolveField(LEAD, "createdAt", "select")).toEqual({
            ok: true,
            field: { kind: "timestamptz", nullable: false, custom: false },
        })
        expect(resolveField(LEAD, "updatedAt", "group").ok).toBe(true)
        expect(resolveField(LEAD, "id.x", "select")).toEqual({ ok: false, code: "QUERY_FIELD_UNKNOWN" })
    })

    it("refuses the workspace field", () => {
        expect(resolveField(LEAD, "workspaceId", "where")).toEqual({ ok: false, code: "QUERY_OWNER_FIELD" })
        expect(resolveField(LEAD, "workspaceId.x", "select")).toEqual({ ok: false, code: "QUERY_OWNER_FIELD" })
    })

    it("refuses an unknown field and a prototype name", () => {
        expect(resolveField(LEAD, "nope", "select")).toEqual({ ok: false, code: "QUERY_FIELD_UNKNOWN" })
        expect(resolveField(LEAD, "constructor", "select")).toEqual({ ok: false, code: "QUERY_FIELD_UNKNOWN" })
    })

    it("refuses a key on a field that is not jsonb", () => {
        expect(resolveField(LEAD, "stage.x", "select")).toEqual({ ok: false, code: "QUERY_FIELD_UNKNOWN" })
        expect(resolveField(LEAD, "nope.x", "select")).toEqual({ ok: false, code: "QUERY_FIELD_UNKNOWN" })
    })

    it("resolves a custom key where its declaration allows", () => {
        const text = { ok: true, field: { kind: "text", nullable: true, custom: true } }
        expect(resolveField(LEAD, "data.tier", "where")).toEqual(text)
        expect(resolveField(LEAD, "data.tier", "order")).toEqual(text)
        expect(resolveField(LEAD, "data.note", "select")).toEqual(text)
        expect(resolveField(LEAD, "data.note", "group")).toEqual(text)
        expect(resolveField(LEAD, "data.rank", "order")).toEqual({
            ok: true,
            field: { kind: "int", nullable: true, custom: true },
        })
    })

    it("refuses a custom key the module did not declare for that use", () => {
        const refused = { ok: false, code: "QUERY_CUSTOM_KEY_UNDECLARED" }
        expect(resolveField(LEAD, "data.note", "where")).toEqual(refused)
        expect(resolveField(LEAD, "data.note", "order")).toEqual(refused)
        expect(resolveField(LEAD, "data.rank", "where")).toEqual(refused)
        expect(resolveField(LEAD, "data.score", "order")).toEqual(refused)
        expect(resolveField(LEAD, "data.missing", "select")).toEqual(refused)
        expect(resolveField(LEAD, "data.constructor", "select")).toEqual(refused)
        expect(resolveField(BLOB, "blob.any", "select")).toEqual(refused)
    })
})

describe("kindClassOf", () => {
    it("groups the kinds into comparison families", () => {
        expect(kindClassOf("int")).toBe("number")
        expect(kindClassOf("enum")).toBe("text")
        expect(kindClassOf("timestamptz")).toBe("time")
        expect(kindClassOf("jsonb")).toBe("json")
        expect(ORDERED_CLASSES.has("bool")).toBe(false)
        expect(ORDERED_CLASSES.has("date")).toBe(true)
    })
})
