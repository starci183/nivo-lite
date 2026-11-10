import { Test } from "@nestjs/testing"
import { isUuid, numberOf, textOf } from "./record-fields.policy"

const POLICY = Symbol("./record-fields.policy")
type PolicySubject = {
    isUuid: typeof isUuid
    numberOf: typeof numberOf
    textOf: typeof textOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { isUuid, numberOf, textOf } }],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)
    return { subject }
}

describe("record fields", () => {
    it("reads text only from text", async () => {
        const { subject } = await buildSubject()

        expect(subject.textOf({ a: "x", b: 1 }, "a")).toBe("x")
        expect(subject.textOf({ a: "x", b: 1 }, "b")).toBeNull()
        expect(subject.textOf({}, "a")).toBeNull()
    })

    it("reads a number from a number or its text", async () => {
        const { subject } = await buildSubject()

        expect(subject.numberOf({ a: 4000 }, "a")).toBe(4000)
        expect(subject.numberOf({ a: "4000" }, "a")).toBe(4000)
        expect(subject.numberOf({ a: "" }, "a")).toBeNull()
        expect(subject.numberOf({ a: "x" }, "a")).toBeNull()
    })

    it("knows a uuid", async () => {
        const { subject } = await buildSubject()

        expect(subject.isUuid("00000000-0000-4000-8000-000000000001")).toBe(true)
        expect(subject.isUuid("event:1")).toBe(false)
    })
})
