import { Test } from "@nestjs/testing"
import { embeddedObject, isJsonRecord, unfenced } from "./json.mapper"

const SUBJECT = Symbol("json.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { isJsonRecord, unfenced, embeddedObject },
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
})
