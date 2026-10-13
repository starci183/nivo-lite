import {
    embeddedObject,
    isJsonRecord,
    numberMember,
    optionalStringMember,
    recordListMember,
    recordMember,
    stringListMember,
    stringMember,
    unfenced,
} from "./json.mapper"

describe("json mapper", () => {
    it("tells an object from everything else", () => {
        expect(isJsonRecord({ a: 1 })).toBe(true)
        expect(isJsonRecord([1])).toBe(false)
        expect(isJsonRecord(null)).toBe(false)
        expect(isJsonRecord("text")).toBe(false)
    })

    it("removes a code fence around an answer", () => {
        expect(unfenced('```json\n{"a":1}\n```')).toBe('{"a":1}')
        expect(unfenced('```\n{"a":1}```')).toBe('{"a":1}')
        expect(unfenced('  {"a":1}  ')).toBe('{"a":1}')
    })

    it("finds the first object inside prose", () => {
        expect(embeddedObject('Sure: {"a":1} done')).toBe('{"a":1}')
        expect(embeddedObject("no object")).toBeNull()
        expect(embeddedObject("} backwards {")).toBeNull()
    })

    it("reads typed members with fallbacks", () => {
        const record = { s: "x", n: 2, bad: Number.NaN, list: [1, "b"], obj: { k: 1 }, objs: [{ a: 1 }, 5, null] }

        expect(stringMember(record, "s", "d")).toBe("x")
        expect(stringMember(record, "n", "d")).toBe("d")
        expect(optionalStringMember(record, "s")).toBe("x")
        expect(optionalStringMember(record, "n")).toBeNull()
        expect(numberMember(record, "n", 0)).toBe(2)
        expect(numberMember(record, "bad", 7)).toBe(7)
        expect(numberMember(record, "s", 7)).toBe(7)
        expect(stringListMember(record, "list")).toEqual(["1", "b"])
        expect(stringListMember(record, "s")).toEqual([])
        expect(recordMember(record, "obj")).toEqual({ k: 1 })
        expect(recordMember(record, "list")).toEqual({})
        expect(recordListMember(record, "objs")).toEqual([{ a: 1 }])
        expect(recordListMember(record, "s")).toEqual([])
    })
})
