import { Test } from "@nestjs/testing"
import type { IntentContract } from "./intent-contracts.contracts"
import { readIntentResult } from "./intent-reading.policy"

const SUBJECT = Symbol("intent-reading.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readIntentResult } }],
    }).compile()
    return moduleRef.get<{ readIntentResult: typeof readIntentResult }>(SUBJECT)
}

const customer = (
    intent: string,
    owns: ReadonlyArray<string> = [],
    risk: IntentContract["risk"] = "none",
): IntentContract => ({
    intent,
    label: intent,
    risk,
    task: "",
    limits: [],
    result: "customer_reply",
    owns,
    checks: ["reply_present", "lead_complete", "order_price_known"],
})

const request: IntentContract = {
    intent: "send_quote",
    label: "Quote",
    risk: "none",
    task: "",
    limits: [],
    result: "agent_request",
    owns: [],
    checks: ["action_is_intent", "action_has_summary"],
}

const reply = customer("reply_customer")
const lead = customer("handoff_lead", ["lead"])
const order = customer("confirm_order", ["order"])
const said = (intent: string, result: unknown, gap: unknown = null) => JSON.stringify({ intent, result, gap })

describe("readIntentResult > the envelope", () => {
    it("is invalid output for a text that is not JSON and keeps it as a draft", async () => {
        const subject = await build()

        expect(subject.readIntentResult("  Sure, here you go  ", [reply])).toMatchObject({
            kind: "safe",
            cause: "invalid_output",
            detail: "not_json",
            draft: "Sure, here you go",
        })
    })

    it("is invalid output for braces that hold no JSON", async () => {
        const subject = await build()

        expect(subject.readIntentResult("{ not json }", [reply])).toMatchObject({ detail: "not_json" })
    })

    it("is invalid output for an envelope with a wrong shape", async () => {
        const subject = await build()

        expect(subject.readIntentResult('{"reply": "hi"}', [reply])).toMatchObject({
            cause: "invalid_output",
            detail: "envelope",
        })
    })

    it("reads a fenced object", async () => {
        const subject = await build()

        const reading = subject.readIntentResult("```json\n" + said("reply_customer", { reply: "Hello" }) + "\n```", [
            reply,
        ])

        expect(reading).toMatchObject({ kind: "picked", result: { reply: "Hello" }, dropped: [] })
    })

    it("is invalid output for an intent it was not offered", async () => {
        const subject = await build()

        expect(subject.readIntentResult(said("give_discount", { reply: "x" }), [reply])).toMatchObject({
            cause: "invalid_output",
            detail: "unknown_intent",
            intent: "give_discount",
        })
    })
})

describe("readIntentResult > none", () => {
    it("is no intent and carries the gap it named", async () => {
        const subject = await build()

        const reading = subject.readIntentResult(
            said("none", {}, { question: "Do you ship to Hue?", topic: "Shipping" }),
            [reply],
        )

        expect(reading).toMatchObject({
            kind: "safe",
            cause: "no_intent",
            intent: null,
            gap: { question: "Do you ship to Hue?", topic: "Shipping" },
        })
    })

    it("is no intent without a gap when it named none", async () => {
        const subject = await build()

        expect(subject.readIntentResult(said("none", {}), [reply])).toMatchObject({ cause: "no_intent", gap: null })
        expect(subject.readIntentResult(said("none", {}, { question: "", topic: "x" }), [reply])).toMatchObject({
            gap: null,
        })
    })
})

describe("readIntentResult > the schema and the checks", () => {
    it("is invalid output when the result breaks the schema, keeping the reply as a draft", async () => {
        const subject = await build()

        expect(subject.readIntentResult(said("reply_customer", { reply: "Hello", extra: 1 }), [reply])).toMatchObject({
            cause: "invalid_output",
            detail: "schema",
            intent: "reply_customer",
            draft: "Hello",
        })
        expect(subject.readIntentResult(said("reply_customer", { reply: 5 }), [reply])).toMatchObject({ draft: "" })
        expect(subject.readIntentResult(said("reply_customer", null), [reply])).toMatchObject({ detail: "schema" })
    })

    it("fails a check by its key and keeps the reply as a draft", async () => {
        const subject = await build()

        const reading = subject.readIntentResult(
            said("reply_customer", { reply: "Done", lead: { contact_name: "An", need: "" } }),
            [reply],
        )

        expect(reading).toMatchObject({ kind: "safe", cause: "check_failed", detail: "lead_complete", draft: "Done" })
    })

    it("picks the intent when the result passes", async () => {
        const subject = await build()

        const reading = subject.readIntentResult(
            said("send_quote", { action: "send_quote", summary: "Quote 3m", fields: { amount_vnd: 3_000_000 } }),
            [reply, request],
        )

        expect(reading).toMatchObject({
            kind: "picked",
            contract: { intent: "send_quote" },
            result: { summary: "Quote 3m" },
        })
    })
})

describe("readIntentResult > the owns rule", () => {
    const withOrder = {
        reply: "ok",
        order: { items: "Combo", amount_vnd: 90_000 },
        lead: { contact_name: "An", need: "x" },
    }

    it("drops a member another offered intent owns and lists it", async () => {
        const subject = await build()

        const reading = subject.readIntentResult(said("reply_customer", withOrder), [reply, lead, order])

        expect(reading).toMatchObject({
            kind: "picked",
            result: { order: null, lead: null },
            dropped: ["lead", "order"],
        })
    })

    it("keeps the members the picked intent owns", async () => {
        const subject = await build()

        const reading = subject.readIntentResult(said("confirm_order", withOrder), [reply, lead, order])

        expect(reading).toMatchObject({ result: { order: { amount_vnd: 90_000 }, lead: null }, dropped: ["lead"] })
    })

    it("keeps every member when the graph holds no owner", async () => {
        const subject = await build()

        const reading = subject.readIntentResult(said("reply_customer", withOrder), [reply])

        expect(reading).toMatchObject({ result: { order: { amount_vnd: 90_000 } }, dropped: [] })
    })

    it("does not list a dropped member that was not set", async () => {
        const subject = await build()

        expect(
            subject.readIntentResult(said("reply_customer", { reply: "ok", order: null }), [reply, order]),
        ).toMatchObject({
            dropped: [],
        })
    })
})

describe("readIntentResult > an intent that runs in a turn of its own", () => {
    const gateway = customer("gateway_call", [], "write")

    it("splits when it is picked without a pin", async () => {
        const subject = await build()

        expect(subject.readIntentResult(said("gateway_call", {}), [reply, gateway])).toEqual({
            kind: "split",
            contract: gateway,
        })
    })

    it("reads the result when the turn is pinned to it", async () => {
        const subject = await build()

        const reading = subject.readIntentResult(
            said("gateway_call", { reply: "Done" }),
            [reply, gateway],
            "gateway_call",
        )

        expect(reading).toMatchObject({ kind: "picked", contract: { intent: "gateway_call" } })
    })

    it("refuses another intent on a pinned turn", async () => {
        const subject = await build()

        expect(
            subject.readIntentResult(said("reply_customer", { reply: "x" }), [reply, gateway], "gateway_call"),
        ).toMatchObject({
            cause: "invalid_output",
            detail: "not_pinned",
        })
    })
})
