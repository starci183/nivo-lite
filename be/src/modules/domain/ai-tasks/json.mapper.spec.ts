import { Test } from "@nestjs/testing"
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

const SUBJECT = Symbol("json.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isJsonRecord,
                    unfenced,
                    embeddedObject,
                    stringMember,
                    optionalStringMember,
                    numberMember,
                    stringListMember,
                    recordMember,
                    recordListMember,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./json.mapper")>(SUBJECT)
}

describe("json mapper", () => {
    it("tells an object from everything else", async () => {
        const subject = await buildSubject()

        expect(subject.isJsonRecord({ a: 1 })).toBe(true)
        expect(subject.isJsonRecord([1])).toBe(false)
        expect(subject.isJsonRecord(null)).toBe(false)
        expect(subject.isJsonRecord("text")).toBe(false)
    })

    it("removes a code fence around an answer", async () => {
        const subject = await buildSubject()

        expect(subject.unfenced('```json\n{"a":1}\n```')).toBe('{"a":1}')
        expect(subject.unfenced('```\n{"a":1}```')).toBe('{"a":1}')
        expect(subject.unfenced('  {"a":1}  ')).toBe('{"a":1}')
    })

    it("finds the first object inside prose", async () => {
        const subject = await buildSubject()

        expect(subject.embeddedObject('Sure: {"a":1} done')).toBe('{"a":1}')
        expect(subject.embeddedObject("no object")).toBeNull()
        expect(subject.embeddedObject("} backwards {")).toBeNull()
    })

    it("reads typed members with fallbacks", async () => {
        const subject = await buildSubject()

        const record = { s: "x", n: 2, bad: Number.NaN, list: [1, "b"], obj: { k: 1 }, objs: [{ a: 1 }, 5, null] }

        expect(subject.stringMember(record, "s", "d")).toBe("x")
        expect(subject.stringMember(record, "n", "d")).toBe("d")
        expect(subject.optionalStringMember(record, "s")).toBe("x")
        expect(subject.optionalStringMember(record, "n")).toBeNull()
        expect(subject.numberMember(record, "n", 0)).toBe(2)
        expect(subject.numberMember(record, "bad", 7)).toBe(7)
        expect(subject.numberMember(record, "s", 7)).toBe(7)
        expect(subject.stringListMember(record, "list")).toEqual(["1", "b"])
        expect(subject.stringListMember(record, "s")).toEqual([])
        expect(subject.recordMember(record, "obj")).toEqual({ k: 1 })
        expect(subject.recordMember(record, "list")).toEqual({})
        expect(subject.recordListMember(record, "objs")).toEqual([{ a: 1 }])
        expect(subject.recordListMember(record, "s")).toEqual([])
    })
})
