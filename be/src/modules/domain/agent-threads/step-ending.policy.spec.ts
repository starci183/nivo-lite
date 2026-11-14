import type { GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import {
    declaredFactsOf,
    endingNoticeKeyOf,
    endingSentenceKeyOf,
    endingTargetsOf,
    factBindingsOf,
    factWordsOf,
    loopNoticeOf,
    reasonValueOf,
    stepEndingOf,
} from "./step-ending.policy"

const ORDER = { label: { vi: "Mã đơn", en: "Order" }, value: { $ref: "steps.create-order.output.orderNo", default: null } }

const step = (unsuccessful?: GraphSpecNode["unsuccessful"]): GraphSpecNode => ({
    key: "tell",
    kind: "execute",
    step: "sales.order-tell",
    ...(unsuccessful === undefined ? {} : { unsuccessful }),
})

// R68: the pure half of the engine's rule: what a step declares, where an `end` goes, what the notice is keyed by and says.
describe("step-ending.policy", () => {
    it("reads a node step's ending; a step that declares nothing, or only a loop's facts, has none", () => {
        expect(stepEndingOf(step({ then: "end", outcome: "declined", facts: [ORDER] }))).toEqual({ then: "end", outcome: "declined", facts: [ORDER] })
        expect(stepEndingOf(step({ then: "continue", facts: [] }))).toEqual({ then: "continue", outcome: null, facts: [] })
        expect(stepEndingOf(step())).toBeNull()
        expect(stepEndingOf(undefined)).toBeNull()
        expect(stepEndingOf(step({ facts: [ORDER] }))).toBeNull()
        // An `end` with no outcome (refused at save) goes on rather than end nowhere.
        expect(stepEndingOf(step({ then: "end", facts: [] }))).toMatchObject({ then: "continue", outcome: null })
    })

    it("reads a loop's notice facts; a node step's ending is no loop notice", () => {
        expect(loopNoticeOf(step({ facts: [ORDER] }))).toEqual([ORDER])
        expect(loopNoticeOf(step({ then: "continue", facts: [ORDER] }))).toBeNull()
        expect(loopNoticeOf(step())).toBeNull()
    })

    it("an `end` adds its outcome step to the places the step may go; `continue` adds none", () => {
        expect(endingTargetsOf(step({ then: "end", outcome: "declined", facts: [] }))).toEqual(["declined"])
        expect(endingTargetsOf(step({ then: "continue", facts: [] }))).toEqual([])
        expect(endingTargetsOf(step())).toEqual([])
    })

    it("keys the notice by run, step and attempt: a replay of the attempt has the same key, a founder's retry a new one", () => {
        expect(endingNoticeKeyOf("run-1", "pay[r2].remind", 1)).toBe("step-ending:run-1:pay[r2].remind:1")
        expect(endingNoticeKeyOf("run-1", "pay[r2].remind", 1)).toBe(endingNoticeKeyOf("run-1", "pay[r2].remind", 1))
        expect(endingNoticeKeyOf("run-1", "pay[r2].remind", 2)).not.toBe(endingNoticeKeyOf("run-1", "pay[r2].remind", 1))
    })

    it("words every reason by the catalogue and states its typed value", () => {
        const reasons = [
            { kind: "send_refused", tool: "nivo.tool.customer.message.send", refusal: "outside_window" },
            { kind: "declined", tool: "nivo.tool.record.create" },
            { kind: "cannot", why: "no_order_code" },
            { kind: "exhausted", rounds: 6 },
        ] as const
        expect(reasons.map((one) => endingSentenceKeyOf(one))).toEqual([
            "agentGraphs.stepEnding.sendRefused",
            "agentGraphs.stepEnding.declined",
            "agentGraphs.stepEnding.cannot",
            "agentGraphs.stepEnding.exhausted",
        ])
        expect(reasons.map((one) => reasonValueOf(one))).toEqual([
            "outside_window",
            "declined (nivo.tool.record.create)",
            "NODE_CANNOT: no_order_code",
            "6",
        ])
    })

    it("resolves the declared facts by place and leaves out a fact that reads nothing", () => {
        const amount = { label: { vi: "Số tiền", en: "Amount" }, value: 250000 }
        const none = { label: { vi: "Ghi chú", en: "Note" }, value: { $ref: "trigger.note", default: null } }
        expect(factBindingsOf([ORDER, amount, none])).toEqual({ 0: ORDER.value, 1: 250000, 2: none.value })
        const facts = declaredFactsOf([ORDER, amount, none], { 0: "DH-0042", 1: 250000, 2: null }, (label) => ("vi" in label ? label.vi : label.key))
        expect(facts).toEqual([
            { name: "Mã đơn", value: "DH-0042" },
            { name: "Số tiền", value: "250000" },
        ])
    })

    it("words a value as text, a list as its items, nothing as null", () => {
        expect(factWordsOf("DH-1")).toBe("DH-1")
        expect(factWordsOf("")).toBeNull()
        expect(factWordsOf(true)).toBe("true")
        expect(factWordsOf(["a", 2, null])).toBe("a, 2")
        expect(factWordsOf([])).toBeNull()
        expect(factWordsOf(undefined)).toBeNull()
        expect(factWordsOf({ a: 1 })).toBe('{"a":1}')
        expect(factWordsOf("x".repeat(500))).toHaveLength(300)
    })
})
