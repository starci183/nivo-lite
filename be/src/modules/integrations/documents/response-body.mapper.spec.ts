import { Test } from "@nestjs/testing"
import { bytesOf, fieldOf, textOf, listOf } from "./response-body.mapper"

const SUBJECT = Symbol("response-body.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { bytesOf, fieldOf, textOf, listOf } }],
    }).compile()
    return moduleRef.get<typeof import("./response-body.mapper")>(SUBJECT)
}

describe("bytesOf", () => {
    it("keeps bytes and answers nothing for any other body", async () => {
        const subject = await build()

        const bytes = Uint8Array.from([1, 2])

        expect(subject.bytesOf(bytes)).toBe(bytes)
        expect(subject.bytesOf("text")).toHaveLength(0)
        expect(subject.bytesOf(undefined)).toHaveLength(0)
    })
})

describe("fieldOf", () => {
    it("reads a field of an object and answers undefined for a value that is not one", async () => {
        const subject = await build()

        expect(subject.fieldOf({ a: 1 }, "a")).toBe(1)
        expect(subject.fieldOf({ a: 1 }, "b")).toBeUndefined()
        expect(subject.fieldOf(null, "a")).toBeUndefined()
        expect(subject.fieldOf("x", "a")).toBeUndefined()
    })
})

describe("textOf and listOf", () => {
    it("keep a text or a list and drop anything else", async () => {
        const subject = await build()

        expect(subject.textOf("a")).toBe("a")
        expect(subject.textOf(1)).toBeUndefined()
        expect(subject.listOf([1])).toEqual([1])
        expect(subject.listOf({})).toEqual([])
    })
})
