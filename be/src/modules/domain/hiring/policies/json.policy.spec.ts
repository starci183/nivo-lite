import { parseJson, parseLooseJson, textField, textList } from "./json.policy"

describe("hiring JSON policy", () => {
    it("returns parsed JSON values and preserves the parser error", () => {
        expect(parseJson(`{"name":"An","count":2}`)).toEqual({ ok: true, value: { name: "An", count: 2 } })
        expect(parseJson("null")).toEqual({ ok: true, value: null })
        expect(parseJson("")).toEqual({ ok: false, cause: new SyntaxError("Unexpected end of JSON input") })
    })

    it("reads objects as plain or fenced JSON", () => {
        expect(parseLooseJson(`  {"name":"An"}  `)).toEqual({ name: "An" })
        expect(parseLooseJson(["```json", `{"name":"An"}`, "```"].join("\n"))).toEqual({ name: "An" })
        expect(parseLooseJson(["```JSON", `{"name":"An"}`, "```"].join(" "))).toEqual({ name: "An" })
        expect(parseLooseJson(["```", `{"name":"An"}`, "```"].join("\n"))).toEqual({ name: "An" })
        expect(parseLooseJson("{}")).toEqual({})
    })

    it("extracts the outer object from surrounding model text", () => {
        expect(parseLooseJson(`Answer: {"nested":{"value":2}} end`)).toEqual({ nested: { value: 2 } })
        expect(parseLooseJson(` [{"value":2}] `)).toEqual({ value: 2 })
    })

    it("returns null when there is no valid JSON object", () => {
        expect(parseLooseJson("plain")).toBeNull()
        expect(parseLooseJson("null")).toBeNull()
        expect(parseLooseJson("42")).toBeNull()
        expect(parseLooseJson(`"name"`)).toBeNull()
        expect(parseLooseJson("[]")).toBeNull()
        expect(parseLooseJson("{")).toBeNull()
        expect(parseLooseJson("} before {")).toBeNull()
        expect(parseLooseJson("prefix {bad} suffix")).toBeNull()
    })

    it("trims string fields and uses empty text for absent or non-string fields", () => {
        expect(textField({ name: " An " }, "name")).toBe("An")
        expect(textField({ name: 2 }, "name")).toBe("")
        expect(textField({}, "name")).toBe("")
        expect(textField(null, "name")).toBe("")
    })

    it("keeps only string list entries without trimming them", () => {
        expect(textList({ skills: [" coffee ", 3, null, true, ""] }, "skills")).toEqual([" coffee ", ""])
        expect(textList({ skills: "coffee" }, "skills")).toEqual([])
        expect(textList({}, "skills")).toEqual([])
        expect(textList(null, "skills")).toEqual([])
    })
})
