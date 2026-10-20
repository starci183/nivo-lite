import { argsHashOf, masked, summaryOf } from "./audit-mask.policy"

describe("audit-mask.policy", () => {
    it("masks secret members at any depth and the tool's own", () => {
        const value = { code: "1234", stay: { key_code: "9", room: "302" }, list: [{ apiKey: "x" }, 3], pin2: "a" }
        expect(masked(value, ["pin2"])).toEqual({
            code: "***",
            stay: { key_code: "***", room: "302" },
            list: [{ apiKey: "***" }, 3],
            pin2: "***",
        })
        expect(masked({ a: null })).toEqual({ a: null })
    })

    it("hashes the arguments independent of key order", () => {
        expect(argsHashOf({ a: 1, b: [{ d: 1, c: 2 }] })).toBe(argsHashOf({ b: [{ c: 2, d: 1 }], a: 1 }))
        expect(argsHashOf({ a: 1 })).toMatch(/^[0-9a-f]{64}$/u)
    })

    it("bounds and masks the summary", () => {
        expect(summaryOf({ code: "1234", validUntil: "x" })).toBe('{"code":"***","validUntil":"x"}')
        expect(summaryOf({ text: "y".repeat(1000) })).toHaveLength(400)
    })
})
