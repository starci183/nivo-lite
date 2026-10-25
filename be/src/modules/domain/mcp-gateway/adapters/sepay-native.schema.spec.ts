import { SEPAY_BANK_MOVE_SCHEMA } from "./sepay-native.schema"

describe.each(["transactions.list", "transactions.debits"])("SePay %s argument schema", () => {
    it("accepts valid filters and supplies the default limit", () => {
        expect(SEPAY_BANK_MOVE_SCHEMA.parse({})).toEqual({ limit: 20 })
        expect(
            SEPAY_BANK_MOVE_SCHEMA.parse({
                status: "matched",
                since: "2026-10-01T07:00:00+07:00",
                limit: 50,
            }),
        ).toEqual({ status: "matched", since: "2026-10-01T07:00:00+07:00", limit: 50 })
        expect(SEPAY_BANK_MOVE_SCHEMA.safeParse({ limit: 1 }).success).toBe(true)
        expect(SEPAY_BANK_MOVE_SCHEMA.safeParse({ since: `2026-10-01T00:00:00.${"1".repeat(19)}Z` }).success).toBe(true)
    })

    it.each([
        ["a limit below one", { limit: 0 }],
        ["a limit above fifty", { limit: 51 }],
        ["a fractional limit", { limit: 1.5 }],
        ["a timestamp below twenty characters", { since: "2026-10-01" }],
        ["a timestamp above forty characters", { since: `2026-10-01T00:00:00.${"1".repeat(20)}Z` }],
        ["an unrecognised status", { status: "lost" }],
        ["an invalid timestamp", { since: "2026-02-30T00:00:00Z" }],
        ["an undeclared filter", { workspaceId: "another-workspace" }],
    ])("rejects %s", (_label, args) => {
        expect(SEPAY_BANK_MOVE_SCHEMA.safeParse(args).success).toBe(false)
    })

    it.each([
        ["the argument object", []],
        ["the argument object", null],
        ["status", { status: 3 }],
        ["status", { status: null }],
        ["since", { since: 7 }],
        ["since", { since: null }],
        ["limit", { limit: "20" }],
        ["limit", { limit: null }],
        ["limit", { limit: false }],
        ["limit", { limit: Number.NaN }],
        ["limit", { limit: Number.POSITIVE_INFINITY }],
    ])("rejects a wrong type for %s", (_label, args) => {
        expect(SEPAY_BANK_MOVE_SCHEMA.safeParse(args).success).toBe(false)
    })
})
