import { Test } from "@nestjs/testing"
import { INTENT_TRIGGER_MAX, isIntentTrigger } from "./intent-trigger.policy"

const SUBJECT = Symbol("intent-trigger")
type TriggerSubject = Pick<typeof import("./intent-trigger.policy"), "isIntentTrigger">

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isIntentTrigger } }],
    }).compile()
    return moduleRef.get<TriggerSubject>(SUBJECT)
}

describe("isIntentTrigger", () => {
    it("accepts a bounded event identity and refuses empty, malformed and overlong identities", async () => {
        const trigger = await build()

        expect(trigger.isIntentTrigger("customer_message")).toBe(true)
        expect(trigger.isIntentTrigger("invoice.paid")).toBe(true)
        expect(trigger.isIntentTrigger("x".repeat(INTENT_TRIGGER_MAX))).toBe(true)
        expect(trigger.isIntentTrigger("x".repeat(INTENT_TRIGGER_MAX + 1))).toBe(false)
        expect(trigger.isIntentTrigger("")).toBe(false)
        expect(trigger.isIntentTrigger("invoice paid")).toBe(false)
        expect(trigger.isIntentTrigger("1invoice")).toBe(false)
    })
})
