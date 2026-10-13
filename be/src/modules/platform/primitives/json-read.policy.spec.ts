import { parseJsonText } from "./json-read.policy"

describe("parseJsonText", () => {
    it("returns the parsed value of valid JSON text", () => {
        expect(parseJsonText('{"appId":"a","n":1}')).toEqual({ ok: true, value: { appId: "a", n: 1 } })
    })

    it("returns a parsed scalar as it is", () => {
        expect(parseJsonText("42")).toEqual({ ok: true, value: 42 })
    })

    it("returns the parse error as the cause of malformed text", () => {
        const read = parseJsonText("{not json")

        expect(read.ok).toBe(false)
        expect(read.ok ? null : read.cause).toBeInstanceOf(SyntaxError)
    })

    it("treats empty text as malformed", () => {
        expect(parseJsonText("").ok).toBe(false)
    })
})
