import { EinvoiceGetSchema, EinvoiceListSchema } from "./einvoice-native.schema"

describe("EinvoiceListSchema", () => {
    it("accepts a valid call and defaults an omitted limit", () => {
        expect(EinvoiceListSchema.parse({ since: "2026-10-01", limit: 50 })).toEqual({
            since: "2026-10-01",
            limit: 50,
        })
        expect(EinvoiceListSchema.parse({})).toEqual({ limit: 20 })
    })

    it.each([
        { since: "2026-10-01x" },
        { since: "2026-10-0" },
        { since: "2026-02-30" },
        { limit: 0 },
        { limit: 51 },
        { limit: 1.5 },
        { since: 20261001 },
        { since: null },
        { limit: "5" },
        { limit: null },
        { extra: true },
        [],
        null,
    ])("rejects exceeded bounds, invalid dates, wrong types and undeclared arguments: %p", (args) => {
        expect(EinvoiceListSchema.safeParse(args).success).toBe(false)
    })
})

describe("EinvoiceGetSchema", () => {
    it("accepts a valid call and the identifier length boundary", () => {
        expect(EinvoiceGetSchema.parse({ id: "rec-1:1" })).toEqual({ id: "rec-1:1" })
        expect(EinvoiceGetSchema.safeParse({ id: "a".repeat(200) }).success).toBe(true)
    })

    it.each([
        { id: "" },
        { id: "a".repeat(201) },
        { id: 7 },
        { id: null },
        {},
        { id: "rec-1:1", extra: true },
        [],
        null,
    ])("rejects exceeded bounds, wrong types and undeclared arguments: %p", (args) => {
        expect(EinvoiceGetSchema.safeParse(args).success).toBe(false)
    })
})
