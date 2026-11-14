import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import { ToolsError, ToolsErrorCode } from "@modules/domain/tools"
import {
    RECORD_REFUSAL_CLASS,
    createOf,
    crossesType,
    isRecordId,
    listPlanOf,
    recordRefusal,
    recordViewOf,
    resultRefusalOf,
    updateOf,
    verbOf,
    writeRefusalOf,
} from "./record-native.policy"
import { RECORD_LIST_SCHEMA } from "./record-native.schema"

/** A record type as a package declares it: a text, an enum with a default, a nullable amount, one index and one unique constraint. */
const PROJECT = defineEntity({
    name: "fixture.project",
    dataKind: "fixture-project",
    fields: {
        title: field.text({ maxLength: 40 }),
        status: field.enum({ of: ["draft", "done"], default: { literal: "draft" } }),
        budgetVnd: field.moneyVnd({ nullable: true }),
    },
    indexes: [{ name: "status_created", on: ["status", { desc: "createdAt" }, { desc: "id" }] }],
    constraints: [{ kind: "unique", name: "title_unique", on: ["title"], refusal: "taken" }],
})

/** A projection: only its jobs write it. */
const TOTALS = defineEntity({
    name: "fixture.totals",
    dataKind: "fixture-totals",
    fields: { count: field.int({ nullable: true }) },
    projection: { sources: ["fixture.project"] },
})

const ID = "0b9f1c2e-6d1a-4f0e-9a37-2f0d5c1b7e11"

const listArgs = (args: Record<string, unknown>) => RECORD_LIST_SCHEMA.parse({ type: PROJECT.name, ...args })

describe("record tool policy", () => {
    it("knows the four verbs by their manifest name and nothing else", () => {
        expect(["get", "list", "create", "update", "delete", "constructor"].map(verbOf)).toEqual([
            "get",
            "list",
            "create",
            "update",
            null,
            null,
        ])
    })

    it("checks a write by the type's own declaration: no second schema", () => {
        expect(writeRefusalOf(PROJECT, createOf(PROJECT.name, { title: "Spring promo" }))).toBeNull()
        expect(writeRefusalOf(PROJECT, createOf(PROJECT.name, {}))).toBe("invalid_value")
        expect(writeRefusalOf(PROJECT, createOf(PROJECT.name, { title: "x".repeat(41) }))).toBe("invalid_value")
        expect(writeRefusalOf(PROJECT, createOf(PROJECT.name, { title: "a", status: "archived" }))).toBe("invalid_value")
        expect(writeRefusalOf(PROJECT, createOf(PROJECT.name, { title: "a", owner: "me" }))).toBe("invalid_value")
        expect(writeRefusalOf(PROJECT, createOf(PROJECT.name, { title: "a", workspaceId: ID }))).toBe("invalid_value")
        expect(writeRefusalOf(PROJECT, updateOf(PROJECT.name, ID, "1", {}))).toBe("invalid_value")
        expect(writeRefusalOf(PROJECT, updateOf(PROJECT.name, "nope", "1", { status: "done" }))).toBe("not_found")
        expect(writeRefusalOf(TOTALS, createOf(TOTALS.name, { count: 1 }))).toBe("type_read_only")
    })

    it("reads what the engine answered of a write that did not happen", () => {
        expect(resultRefusalOf({ ok: false, reason: "taken", constraint: "title_unique", refusal: "taken" })).toBe("taken")
        expect(resultRefusalOf({ ok: false, reason: "stale" })).toBe("stale")
        expect(resultRefusalOf({ ok: false, reason: "missing" })).toBe("not_found")
        expect(resultRefusalOf({ ok: false, reason: "invalid" })).toBe("invalid_value")
    })

    it("orders a list by the first declared index its filter is served by when the call names no order", () => {
        const plan = listPlanOf(PROJECT, listArgs({ where: { op: "eq", field: "status", value: "draft" } }))
        expect(plan).toEqual({
            kind: "query",
            query: {
                from: PROJECT.name,
                select: ["title", "status", "budgetVnd"],
                where: { op: "eq", field: "status", value: "draft" },
                order: [
                    ["status", "asc"],
                    ["createdAt", "desc"],
                    ["id", "desc"],
                ],
                page: { size: 20 },
            },
        })
        const unique = listPlanOf(PROJECT, listArgs({ where: { op: "eq", field: "title", value: "a" }, limit: 50, cursor: "c1" }))
        expect(unique).toMatchObject({ kind: "query", query: { order: [["title", "asc"], ["id", "asc"]], page: { size: 50, after: "c1" } } })
    })

    it("closes a named order by the record id, and refuses an order no declared index serves", () => {
        const served = listPlanOf(PROJECT, listArgs({ order: [["status", "desc"], ["createdAt", "asc"]] }))
        expect(served).toMatchObject({ kind: "query", query: { order: [["status", "desc"], ["createdAt", "asc"], ["id", "asc"]] } })
        expect(listPlanOf(PROJECT, listArgs({ order: [["budgetVnd", "asc"]] }))).toEqual({ kind: "refused", reason: "query_not_indexed" })
        expect(listPlanOf(TOTALS, RECORD_LIST_SCHEMA.parse({ type: TOTALS.name }))).toEqual({
            kind: "refused",
            reason: "query_not_indexed",
        })
    })

    it("refuses a filter off the type's fields, and one that reaches into another type", () => {
        expect(listPlanOf(PROJECT, listArgs({ where: { op: "eq", field: "owner", value: "me" } }))).toEqual({
            kind: "refused",
            reason: "query_invalid",
        })
        expect(listPlanOf(PROJECT, listArgs({ where: { op: "eq", field: "workspaceId", value: ID } }))).toEqual({
            kind: "refused",
            reason: "query_invalid",
        })
        const reach = { op: "and", of: [{ op: "not", of: { op: "has", relation: "items" } }] } as const
        expect(crossesType(reach)).toBe(true)
        expect(listPlanOf(PROJECT, listArgs({ where: reach }))).toEqual({ kind: "refused", reason: "query_invalid" })
    })

    it("answers a record with its system fields and its declared fields under values", () => {
        const row = { id: ID, workspaceId: "ws-1", version: "3", createdAt: "a", updatedAt: "b", data: { title: "t" } }
        expect(recordViewOf(row)).toEqual({ id: ID, version: "3", createdAt: "a", updatedAt: "b", values: { title: "t" } })
        expect(isRecordId(ID)).toBe(true)
        expect(isRecordId("1; drop")).toBe(false)
    })

    it("throws every refusal as a native refusal carrying its class, the infrastructure ones freezing the step", () => {
        const refused = recordRefusal("type_unknown")
        expect(refused).toBeInstanceOf(ToolsError)
        expect(refused.code).toBe(ToolsErrorCode.NativeRefused)
        expect(refused.params).toEqual({ reason: "type_unknown", refusalClass: "business" })
        expect(Object.entries(RECORD_REFUSAL_CLASS).filter(([, kind]) => kind === "infrastructure").map(([code]) => code)).toEqual([
            "type_read_only",
            "not_served",
        ])
    })
})
