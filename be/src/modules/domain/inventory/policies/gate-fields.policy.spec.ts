import { Test } from "@nestjs/testing"
import { fieldNumber, fieldText } from "./gate-fields.policy"

const SUBJECT = Symbol("gate-fields.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { fieldText, fieldNumber } }],
    }).compile()
    return moduleRef.get<typeof import("./gate-fields.policy")>(SUBJECT)
}

describe("fieldText", () => {
    it("reads a fact as text", async () => {
        const subject = await buildSubject()

        expect(subject.fieldText({ reason: "count", delta: 4, ok: true }, "reason")).toBe("count")
        expect(subject.fieldText({ delta: 4 }, "delta")).toBe("4")
    })

    it("reads a missing or null fact as the empty text", async () => {
        const subject = await buildSubject()

        expect(subject.fieldText({ reason: null }, "reason")).toBe("")
        expect(subject.fieldText({}, "reason")).toBe("")
    })
})

describe("fieldNumber", () => {
    it("reads a fact as a number", async () => {
        const subject = await buildSubject()

        expect(subject.fieldNumber({ delta: -3 }, "delta")).toBe(-3)
        expect(subject.fieldNumber({ delta: "7" }, "delta")).toBe(7)
    })

    it("reads anything else as zero", async () => {
        const subject = await buildSubject()

        expect(subject.fieldNumber({ delta: "x" }, "delta")).toBe(0)
        expect(subject.fieldNumber({}, "delta")).toBe(0)
    })
})
