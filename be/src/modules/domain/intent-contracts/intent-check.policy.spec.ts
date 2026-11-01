import { Test } from "@nestjs/testing"
import { REPLY_CHECK_MAX, checkResult, failedCheckOf } from "./intent-check.policy"

const SUBJECT = Symbol("intent-check.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { checkResult, failedCheckOf } }],
    }).compile()
    const subject = moduleRef.get<{ checkResult: typeof checkResult; failedCheckOf: typeof failedCheckOf }>(SUBJECT)
    return { check: subject.checkResult, failedCheckOf: subject.failedCheckOf }
}

const reply = (patch: Record<string, unknown> = {}) => ({ intent: "reply_customer", result: { reply: "Hi", ...patch } })

describe("INTENT_CHECKS > reply", () => {
    it("wants a reply that is not empty", async () => {
        const { check } = await build()

        expect(check("reply_present", reply())).toBe(true)
        expect(check("reply_present", reply({ reply: "  " }))).toBe(false)
        expect(check("reply_present", reply({ reply: null }))).toBe(false)
    })

    it("bounds the reply", async () => {
        const { check } = await build()

        expect(check("reply_bounded", reply({ reply: "a".repeat(REPLY_CHECK_MAX) }))).toBe(true)
        expect(check("reply_bounded", reply({ reply: "a".repeat(REPLY_CHECK_MAX + 1) }))).toBe(false)
        expect(check("reply_bounded", reply({ reply: 3 }))).toBe(false)
    })
})

describe("INTENT_CHECKS > lead and order", () => {
    it("holds a lead to a contact name and a need, and lets an absent lead pass", async () => {
        const { check } = await build()

        expect(check("lead_complete", reply({ lead: null }))).toBe(true)
        expect(check("lead_complete", reply({ lead: { contact_name: "An", need: "a quote" } }))).toBe(true)
        expect(check("lead_complete", reply({ lead: { contact_name: "An", need: " " } }))).toBe(false)
    })

    it("holds an order to its items and a whole amount above zero", async () => {
        const { check } = await build()
        const order = (patch: Record<string, unknown>) =>
            reply({ order: { items: "Combo", amount_vnd: 90_000, ...patch } })

        expect(check("order_complete", reply({ order: null }))).toBe(true)
        expect(check("order_complete", order({}))).toBe(true)
        expect(check("order_complete", order({ items: "" }))).toBe(false)
        expect(check("order_complete", order({ amount_vnd: "90000" }))).toBe(false)
        expect(check("order_price_known", order({}))).toBe(true)
        expect(check("order_price_known", order({ amount_vnd: 0 }))).toBe(false)
        expect(check("order_price_known", reply())).toBe(true)
    })
})

describe("INTENT_CHECKS > request", () => {
    it("wants the action to be the intent and a summary", async () => {
        const { check } = await build()
        const request = { intent: "send_quote", result: { action: "send_quote", summary: "Quote 3m" } }

        expect(check("action_is_intent", request)).toBe(true)
        expect(check("action_is_intent", { ...request, intent: "give_discount" })).toBe(false)
        expect(check("action_has_summary", request)).toBe(true)
        expect(check("action_has_summary", { ...request, result: { action: "send_quote", summary: "" } })).toBe(false)
    })
})

describe("failedCheckOf", () => {
    it("answers the first check that fails, or null", async () => {
        const subject = await build()

        expect(subject.failedCheckOf(["reply_present", "reply_bounded"], reply())).toBeNull()
        expect(subject.failedCheckOf(["reply_present", "lead_complete"], reply({ reply: "", lead: {} }))).toBe(
            "reply_present",
        )
        expect(subject.failedCheckOf([], reply())).toBeNull()
    })
})
