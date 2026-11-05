import { fieldValueSchema } from "./field-value"
import { leadEntity } from "./mutation.fixture"

const accepts = (field: string, value: unknown): boolean => {
    const def = leadEntity.fields[field]
    return def !== undefined && fieldValueSchema(def).safeParse(value).success
}

describe("fieldValueSchema", () => {
    it("parses each field kind and refuses a value off it", () => {
        expect(accepts("ref", "5b0c3e1a-6c27-4a92-8d40-2a6f0f7a9b10")).toBe(true)
        expect(accepts("ref", "nope")).toBe(false)
        expect(accepts("name", "short")).toBe(true)
        expect(accepts("name", "x".repeat(11))).toBe(false)
        expect(accepts("stage", "won")).toBe(true)
        expect(accepts("stage", "lost")).toBe(false)
        expect(accepts("amount", 1000)).toBe(true)
        expect(accepts("amount", 1.5)).toBe(false)
        expect(accepts("count", 3)).toBe(true)
        expect(accepts("big", "9007199254740993")).toBe(true)
        expect(accepts("big", 12)).toBe(true)
        expect(accepts("big", "12x")).toBe(false)
        expect(accepts("flag", true)).toBe(true)
        expect(accepts("flag", "yes")).toBe(false)
        expect(accepts("day", "2026-11-05")).toBe(true)
        expect(accepts("day", "05/11/2026")).toBe(false)
        expect(accepts("at", "2026-11-05T10:00:00.123456Z")).toBe(true)
        expect(accepts("at", "yesterday")).toBe(false)
    })

    it("allows null only on a nullable field", () => {
        expect(accepts("phone", null)).toBe(true)
        expect(accepts("name", null)).toBe(false)
    })

    it("parses a jsonb value through its declared shape and refuses one without a shape", () => {
        expect(accepts("data", { tag: "ab" })).toBe(true)
        expect(accepts("data", { tag: "abcdefg" })).toBe(false)
        expect(accepts("loose", { a: 1 })).toBe(false)
    })

    it("refuses any value for an enum without values and for a sequence", () => {
        expect(accepts("broken", "a")).toBe(false)
        expect(accepts("orderNo", "DH-00001")).toBe(false)
    })

    it("bounds a text without a declared maxLength at the text bound", () => {
        const schema = fieldValueSchema({ kind: "text", nullable: false })
        expect(schema.safeParse("x".repeat(4000)).success).toBe(true)
        expect(schema.safeParse("x".repeat(4001)).success).toBe(false)
    })
})
