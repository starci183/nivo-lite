import { Test } from "@nestjs/testing"
import { testRegistry } from "@tests/fixtures/builders/intent-domain.builder"
import { failedCheckOf } from "./intent-check.policy"

const SUBJECT = Symbol("intent-check.policy")

const LOOKUP = testRegistry()

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { failedCheckOf } }],
    }).compile()
    return moduleRef.get<{ failedCheckOf: typeof failedCheckOf }>(SUBJECT)
}

describe("failedCheckOf > the checks of the generic request", () => {
    const request = { intent: "send_quote", result: { action: "send_quote", summary: "Quote 3m" } }
    const KEYS = ["action_is_intent", "action_has_summary"]

    it("passes a request whose action is the intent and that says its work", async () => {
        const subject = await build()

        expect(subject.failedCheckOf(KEYS, request, LOOKUP)).toBeNull()
    })

    it("fails the action that is not the intent and the summary that is empty or not a text", async () => {
        const subject = await build()

        expect(subject.failedCheckOf(KEYS, { ...request, intent: "give_discount" }, LOOKUP)).toBe("action_is_intent")
        expect(
            subject.failedCheckOf(KEYS, { ...request, result: { action: "send_quote", summary: " " } }, LOOKUP),
        ).toBe("action_has_summary")
        expect(subject.failedCheckOf(KEYS, { ...request, result: { action: "send_quote", summary: 3 } }, LOOKUP)).toBe(
            "action_has_summary",
        )
    })
})

describe("failedCheckOf > the list", () => {
    it("answers the first check that fails, or null", async () => {
        const subject = await build()
        const input = { intent: "reply_customer", result: { reply: "", lead: { need: "" } } }

        expect(
            subject.failedCheckOf(["reply_present", "lead_complete"], { ...input, result: { reply: "Hi" } }, LOOKUP),
        ).toBeNull()
        expect(subject.failedCheckOf(["reply_present", "lead_complete"], input, LOOKUP)).toBe("reply_present")
        expect(subject.failedCheckOf([], input, LOOKUP)).toBeNull()
    })

    it("fails a key nobody registered", async () => {
        const subject = await build()

        expect(subject.failedCheckOf(["nobody_knows"], { intent: "a", result: {} }, LOOKUP)).toBe("nobody_knows")
    })
})
