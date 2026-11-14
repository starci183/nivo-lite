import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import { compareBy, isNil, matches, pick, signOf, valueOf } from "./accounting.memory-rows"

const row = (id: string, data: Readonly<Record<string, unknown>>): RecordRow => ({
    id,
    workspaceId: "w1",
    version: "2",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-02T00:00:00.000Z",
    data,
})

const A = row("a", { kind: "income", amountVnd: 9, note: null })
const B = row("b", { kind: "invoice", amountVnd: 10 })

describe("valueOf", () => {
    it("reads a system field from the record and any other field from its data", () => {
        expect(valueOf(A, "id")).toBe("a")
        expect(valueOf(A, "version")).toBe("2")
        expect(valueOf(A, "createdAt")).toBe("2026-11-01T00:00:00.000Z")
        expect(valueOf(A, "updatedAt")).toBe("2026-11-02T00:00:00.000Z")
        expect(valueOf(A, "kind")).toBe("income")
        expect(valueOf(A, "nope")).toBeUndefined()
    })
})

describe("isNil", () => {
    it("is true for null and absent, false for anything else", () => {
        expect([null, undefined, 0, "", false].map(isNil)).toEqual([true, true, false, false, false])
    })
})

describe("signOf", () => {
    it("compares numbers by size and anything else as text", () => {
        expect(signOf(9, 10)).toBe(-1)
        expect(signOf(10, 9)).toBe(1)
        expect(signOf(9, 9)).toBe(0)
        expect(signOf("a", "b")).toBe(-1)
        expect(signOf("b", "a")).toBe(1)
        expect(signOf("a", "a")).toBe(0)
    })
})

describe("matches", () => {
    it("matches every record without a condition", () => {
        expect(matches(A, undefined)).toBe(true)
    })

    it("matches by equality, membership, range and conjunction", () => {
        expect(matches(A, q.eq("kind", "income"))).toBe(true)
        expect(matches(B, q.eq("kind", "income"))).toBe(false)
        expect(matches(B, q.in("kind", ["income", "invoice"]))).toBe(true)
        expect(matches(B, q.in("kind", ["income"]))).toBe(false)
        expect(matches(A, q.gte("amountVnd", 9))).toBe(true)
        expect(matches(A, q.gte("amountVnd", 10))).toBe(false)
        expect(matches(A, q.lt("amountVnd", 10))).toBe(true)
        expect(matches(B, q.lt("amountVnd", 10))).toBe(false)
        expect(matches(A, q.and(q.eq("kind", "income"), q.gte("amountVnd", 9)))).toBe(true)
        expect(matches(A, q.and(q.eq("kind", "income"), q.gte("amountVnd", 10)))).toBe(false)
    })

    it("matches a record that has a value for notNull", () => {
        expect(matches(A, q.notNull("kind"))).toBe(true)
        expect(matches(A, q.notNull("missing"))).toBe(false)
    })

    it("matches nothing for an operator the module never writes", () => {
        expect(matches(A, q.ne("kind", "invoice"))).toBe(false)
    })
})

describe("compareBy", () => {
    it("orders by the first field that differs, in its direction", () => {
        const ids = (order: Parameters<typeof compareBy>[0]): ReadonlyArray<string> =>
            [A, B, row("c", { kind: "income", amountVnd: 9 })].toSorted(compareBy(order)).map((record) => record.id)
        expect(ids([["amountVnd", "desc"]])).toEqual(["b", "a", "c"])
        expect(
            ids([
                ["amountVnd", "asc"],
                ["id", "desc"],
            ]),
        ).toEqual(["c", "a", "b"])
    })
})

describe("pick", () => {
    it("keeps the selected fields of the data only", () => {
        expect(pick({ kind: "income", amountVnd: 9, note: null }, ["kind", "note"])).toEqual({
            kind: "income",
            note: null,
        })
    })
})
