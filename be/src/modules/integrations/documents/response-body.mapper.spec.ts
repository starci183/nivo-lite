import { bytesOf, fieldOf, listOf, textOf } from "./response-body.mapper"

describe("bytesOf", () => {
    it("keeps bytes and answers nothing for any other body", () => {
        const bytes = Uint8Array.from([1, 2])

        expect(bytesOf(bytes)).toBe(bytes)
        expect(bytesOf("text")).toHaveLength(0)
        expect(bytesOf(undefined)).toHaveLength(0)
    })
})

describe("fieldOf", () => {
    it("reads a field of an object and answers undefined for a value that is not one", () => {
        expect(fieldOf({ a: 1 }, "a")).toBe(1)
        expect(fieldOf({ a: 1 }, "b")).toBeUndefined()
        expect(fieldOf(null, "a")).toBeUndefined()
        expect(fieldOf("x", "a")).toBeUndefined()
    })
})

describe("textOf and listOf", () => {
    it("keep a text or a list and drop anything else", () => {
        expect(textOf("a")).toBe("a")
        expect(textOf(1)).toBeUndefined()
        expect(listOf([1])).toEqual([1])
        expect(listOf({})).toEqual([])
    })
})
