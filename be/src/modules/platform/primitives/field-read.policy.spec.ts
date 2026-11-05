import { Test } from "@nestjs/testing"
import { fieldNumberOf, fieldTextOf, fieldTextOrNullOf } from "./field-read.policy"

const SUBJECT = Symbol("field-read.policy")
interface Subject {
    readonly fieldTextOf: typeof fieldTextOf
    readonly fieldTextOrNullOf: typeof fieldTextOrNullOf
    readonly fieldNumberOf: typeof fieldNumberOf
}

const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { fieldTextOf, fieldTextOrNullOf, fieldNumberOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("field readers", () => {
    it("reads text, or nothing when the value is not text", async () => {
        const subject = await buildSubject()

        expect(subject.fieldTextOf("a")).toBe("a")
        expect(subject.fieldTextOf(3)).toBeUndefined()
        expect(subject.fieldTextOrNullOf("a")).toBe("a")
        expect(subject.fieldTextOrNullOf(null)).toBeNull()
    })

    it.each([
        [12, 12],
        ["12.5", 12.5],
        ["lots", undefined],
        [Number.NaN, undefined],
        [null, undefined],
        [{}, undefined],
    ])("reads %j as the number %s", async (value, expected) => {
        const subject = await buildSubject()

        expect(subject.fieldNumberOf(value)).toBe(expected)
    })
})
