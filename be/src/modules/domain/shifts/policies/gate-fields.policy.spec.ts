import { Test } from "@nestjs/testing"
import { fieldText } from "./gate-fields.policy"

const SUBJECT = Symbol("gate-fields.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { fieldText } }],
    }).compile()
    return moduleRef.get<typeof import("./gate-fields.policy")>(SUBJECT)
}

describe("fieldText", () => {
    it("reads a missing or null fact as empty text", async () => {
        const subject = await build()

        expect(subject.fieldText({}, "missing")).toBe("")
        expect(subject.fieldText({ value: null }, "value")).toBe("")
    })

    it("renders every non-null gate field value as text", async () => {
        const subject = await build()

        const fields = { text: "shift-1", empty: "", number: 24, zero: 0, yes: true, no: false }

        expect(subject.fieldText(fields, "text")).toBe("shift-1")
        expect(subject.fieldText(fields, "empty")).toBe("")
        expect(subject.fieldText(fields, "number")).toBe("24")
        expect(subject.fieldText(fields, "zero")).toBe("0")
        expect(subject.fieldText(fields, "yes")).toBe("true")
        expect(subject.fieldText(fields, "no")).toBe("false")
    })
})
