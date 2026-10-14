import { clean, clip, messageOf, uuidOrNull } from "./app-errors.policy"

describe("clip", () => {
    it("cuts a long text and marks the cut", () => {
        expect(clip("abcdef", 3)).toBe("abc…")
        expect(clip("abc", 3)).toBe("abc")
    })
})

describe("clean", () => {
    it("scrubs credentials and bounds the length", () => {
        const out = clean("failed with token=abcdef123 after retry", 200)

        expect(out).not.toContain("abcdef123")
        expect(clean("x".repeat(50), 10)).toHaveLength(11)
    })
})

describe("messageOf", () => {
    it("reads an error, a text and any other value", () => {
        expect(messageOf(new Error("boom"))).toBe("boom")
        expect(messageOf("plain")).toBe("plain")
        expect(messageOf({ code: 7, password: "p" })).toBe('{"code":7,"password":"[redacted]"}')
    })

    it("falls back to text when redaction has no JSON representation", () => {
        expect(messageOf(undefined)).toBe("undefined")
        expect(messageOf(Symbol("failed"))).toBe("Symbol(failed)")
        expect(messageOf(null)).toBe("null")
    })
})

describe("uuidOrNull", () => {
    it("keeps only a uuid", () => {
        expect(uuidOrNull("3f1c2b9e-1d2a-4c3b-9a8e-0f1e2d3c4b5a")).toBe("3f1c2b9e-1d2a-4c3b-9a8e-0f1e2d3c4b5a")
        expect(uuidOrNull("ws-1")).toBeNull()
        expect(uuidOrNull(null)).toBeNull()
    })
})
