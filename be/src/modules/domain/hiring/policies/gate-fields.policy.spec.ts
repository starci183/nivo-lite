import { Test } from "@nestjs/testing"
import { fieldNumber as fieldNumberImplementation, fieldText as fieldTextImplementation } from "./gate-fields.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    fieldNumber: typeof fieldNumberImplementation
    fieldText: typeof fieldTextImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { fieldNumber: fieldNumberImplementation, fieldText: fieldTextImplementation },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("gate fields policy", () => {
    describe("fieldText", () => {
        it("returns empty text for absent and null fields", async () => {
            const subject = await buildSubject()

            expect(subject.fieldText({}, "missing")).toBe("")
            expect(subject.fieldText({ value: null }, "value")).toBe("")
        })

        it("converts present values to exact text", async () => {
            const subject = await buildSubject()

            expect(subject.fieldText({ value: "Alex" }, "value")).toBe("Alex")
            expect(subject.fieldText({ value: "" }, "value")).toBe("")
            expect(subject.fieldText({ value: 42 }, "value")).toBe("42")
            expect(subject.fieldText({ value: 0 }, "value")).toBe("0")
            expect(subject.fieldText({ value: true }, "value")).toBe("true")
            expect(subject.fieldText({ value: false }, "value")).toBe("false")
        })
    })

    describe("fieldNumber", () => {
        it("reads numbers, numeric text and booleans", async () => {
            const subject = await buildSubject()

            expect(subject.fieldNumber({ value: 42 }, "value")).toBe(42)
            expect(subject.fieldNumber({ value: "12.5" }, "value")).toBe(12.5)
            expect(subject.fieldNumber({ value: -3 }, "value")).toBe(-3)
            expect(subject.fieldNumber({ value: true }, "value")).toBe(1)
        })

        it("uses zero for absent, null, empty, false and unreadable values", async () => {
            const subject = await buildSubject()

            expect(subject.fieldNumber({}, "missing")).toBe(0)
            expect(subject.fieldNumber({ value: null }, "value")).toBe(0)
            expect(subject.fieldNumber({ value: "" }, "value")).toBe(0)
            expect(subject.fieldNumber({ value: "letters" }, "value")).toBe(0)
            expect(subject.fieldNumber({ value: false }, "value")).toBe(0)
            expect(subject.fieldNumber({ value: 0 }, "value")).toBe(0)
        })
    })
})
