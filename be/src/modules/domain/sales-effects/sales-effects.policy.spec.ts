import { Test } from "@nestjs/testing"
import { isRecordId as realIsRecordId, payloadOf as realPayloadOf } from "./sales-effects.policy"
import { confirmSchema } from "./sales-effects.schema"

const SUBJECT = Symbol("sales-effects.policy")

interface Subject {
    readonly isRecordId: typeof realIsRecordId
    readonly payloadOf: typeof realPayloadOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isRecordId: realIsRecordId, payloadOf: realPayloadOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("the policy of the Sales effects", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("tells a record id from any other text", () => {
        expect(subject.isRecordId("11111111-1111-4111-8111-111111111111")).toBe(true)
        expect(subject.isRecordId("lead-1")).toBe(false)
    })

    it("reads a payload under the schema of its effect", () => {
        expect(subject.payloadOf(confirmSchema, { orderId: "o-1", extra: 1 })).toEqual({ orderId: "o-1" })
    })

    it("refuses a payload that is not what the effect asks for", () => {
        expect(() => subject.payloadOf(confirmSchema, { orderId: "" })).toThrow("SALES_EFFECTS_INVALID_PAYLOAD")
    })
})
