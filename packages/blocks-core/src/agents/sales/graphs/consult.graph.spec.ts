import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { callInputsOf } from "@nivo-lite/agent-sdk/graph"
import type { GraphV2Step, StoredExpr, StoredRef } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { exprHolds } from "@nivo-lite/agent-sdk/template"
import { salesConsultTurnNode } from "../nodes/consult-turn.node"
import { salesCreditReadNode } from "../nodes/credit-read.node"
import { salesNotSaleNoticeNode } from "../nodes/not-sale-notice.node"
import { salesOrderCreateNode } from "../nodes/order-create.node"
import { salesOrderPaidNode } from "../nodes/order-paid.node"
import { salesOrderReadNode } from "../nodes/order-read.node"
import { salesConsultGraph } from "./consult.graph"

// The SALE AS ONE RUN (owner's final rule 7, 2026-11-14): the talk, the order and the payment wait are one graph; the reminder is the
// payment wait's timeout; no `recentLines` is handed in. Importing the graph builds it: reaching here means every save check holds.
// v24 (R32, R33): each round of the talk starts with the wait (round 1, which has no event, skips it); ONE consult reads THAT round's
// message; `off` hands it back in a round that waited, ends `not-sale` in round 1; the payment wait takes money IN only and a credit off
// the total tells the team too. v25 (R41): Q10 round 1 not about a sale tells the team the route and the words; Q8 a declined paid record
// ends the payment loop. v26/v28 (S5c, S5d): the conditions are evaluated against the nodes' OWN example outputs and the loop output the
// engine records. v30 (R68, owner "cook luôn"): PURE BUSINESS. Every "was it declined / not delivered -> team notice" pair of v25-v29 is
// gone: the step declares its `unsuccessful` ending and the ENGINE tells the team (one post per ending, the same count as the old notice
// nodes), then goes on (`continue`) or ends at the declared outcome (`end`). What the team is told is now the engine's card (its kind and
// the facts the step declares); the outcomes are the same.

const steps = salesConsultGraph.spec.nodes
const stepOf = (key: string): GraphV2Step | undefined => steps.find((step) => step.key === key)

/** The stored condition of an if-step, or the `until` of a loop. */
const conditionOf = (key: string, member: "when" | "until"): StoredExpr => {
    const step = stepOf(key) as { readonly params: Readonly<Record<string, StoredExpr>> } | undefined
    const found = step?.params[member]
    if (found === undefined) throw new Error(`no ${member} on ${key}`)
    return found
}

/** A reader of refs over a run scope: a dotted path into `scope`, else the ref's default. */
const readerOf =
    (scope: Readonly<Record<string, JsonValue>>) =>
    (ref: StoredRef): JsonValue => {
        const path = ref.$ref.split(".")
        let at: JsonValue | undefined = scope as JsonValue
        for (const part of path) at = at !== null && typeof at === "object" && !Array.isArray(at) ? (at as Record<string, JsonValue>)[part] : undefined
        return at === undefined ? (ref.default ?? null) : at
    }

/** The output a node's own example answers, found by a member of it. */
const exampleOutput = (examples: ReadonlyArray<{ readonly output?: unknown }>, has: (output: Record<string, JsonValue>) => boolean): Record<string, JsonValue> => {
    const found = examples.map((example) => example.output as Record<string, JsonValue> | undefined).find((output) => output !== undefined && has(output))
    if (found === undefined) throw new Error("no such example output")
    return found
}

/** The ref paths an expression reads, every leaf. */
const refsOf = (expr: unknown): ReadonlyArray<string> => {
    if (expr === null || typeof expr !== "object") return []
    if ("$ref" in expr && typeof expr.$ref === "string") return [expr.$ref]
    return Object.values(expr).flatMap((part) => refsOf(part))
}

describe("sales.consult v30: the sale as one run", () => {
    // v28 (ruling R45): the hand-off also carries the visit's start (`since`): the consult reads the engine's thread itself.
    it("is version 30, called by the front desk with the route, the words, the channel, the person and the visit's start (no recentLines)", () => {
        expect(salesConsultGraph.key).toBe("sales.consult")
        expect(salesConsultGraph.spec.catalogue?.version).toBe(30)
        expect(salesConsultGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(callInputsOf(salesConsultGraph.spec.contract).map((one) => one.name).toSorted()).toEqual(["channel", "contactId", "conversationId", "since", "text"])
        const consult = JSON.stringify((stepOf("consult") as { params: unknown }).params)
        expect(consult).toContain('"$ref":"trigger.data.since"')
        expect(consult).not.toContain("recentLines")
    })

    it("talks in a loop of at most 30 rounds: round 1 consults the hand-off, later rounds wait for the person's next message first", () => {
        expect(stepOf("talk")).toMatchObject({ kind: "loop", params: { mode: "until", max: 30 }, next: "keep-occasions", routes: { exhausted: "quiet" } })
        expect(stepOf("opening")).toMatchObject({ kind: "if", loop: "talk", params: { when: { op: "eq", ref: { $ref: "item.$round" }, value: 1 } }, routes: { yes: "consult", no: "hear" } })
        expect(stepOf("hear")).toMatchObject({ kind: "wait", step: "core.wait", loop: "talk", routes: { zalo: "consult", telegram: "consult" } })
        expect(steps.filter((step) => step.kind === "node" && step.step === "sales.consult-turn").map((step) => step.key)).toEqual(["consult"])
        // Only the draft comes from the round before (R13); the message is this round's.
        expect(JSON.stringify(stepOf("consult"))).toContain('"round":"previous"')
        expect(JSON.stringify((stepOf("consult") as { params: unknown }).params)).toContain('"$ref":"steps.hear.output.event.data.text","default":null}')
        // Not about a sale: handed back in a round that waited; round 1 ends the talk.
        expect(stepOf("consult")).toMatchObject({ routes: { off: "off-round" } })
        expect(stepOf("off-round")).toMatchObject({ kind: "if", routes: { yes: "not-sale-notice", no: "give-back-talk" } })
        expect(stepOf("give-back-talk")).toMatchObject({ kind: "hand-back", key: "give-back-talk", loop: "talk", step: "core.hand-back", params: { wait: "hear" } })
    })

    it("the payment wait takes money IN only, and a credit off the total tells the customer and the team (R32)", () => {
        expect(JSON.stringify(stepOf("await"))).toContain('{"param":"data.direction","op":"equals","value":"in"}')
        expect(stepOf("short")).toMatchObject({ next: "short-notice" })
        expect(stepOf("short-notice")).toMatchObject({ kind: "node", step: "sales.credit-notice", loop: "pay" })
    })

    it("records the order, sends the QR and tells the customer, then waits for the money in a loop of at most 6 rounds", () => {
        expect(stepOf("create-order")).toMatchObject({ step: "sales.order-create", next: "request-qr" })
        expect(stepOf("request-qr")).toMatchObject({ next: "tell-order" })
        expect(stepOf("tell-order")).toMatchObject({ next: "pay" })
        expect(stepOf("pay")).toMatchObject({ kind: "loop", params: { mode: "until", max: 6 }, next: "to-after-sale", routes: { exhausted: "unpaid" } })
        expect((stepOf("await") as { routes: Record<string, string> }).routes).toMatchObject({ credit: "credit", zalo: "order-talk", timeout: "remind" })
    })

    it("a message during the payment wait goes to order-talk, routed by meaning; the reminder is the wait's timeout", () => {
        expect(stepOf("order-talk")).toMatchObject({ kind: "node", step: "sales.order-talk", loop: "pay", routes: { off: "give-back" } })
        // `about` ends the round (no route written: the engine's round end); `off` hands the event the payment wait took back (R11).
        expect((stepOf("order-talk") as { routes: Record<string, string> }).routes).not.toHaveProperty("about")
        expect(stepOf("give-back")).toMatchObject({ kind: "hand-back", key: "give-back", loop: "pay", step: "core.hand-back", params: { wait: "await" } })
        expect(stepOf("remind")).toMatchObject({ kind: "node", step: "sales.payment-remind", loop: "pay" })
        expect(stepOf("remind")).not.toHaveProperty("next")
        expect(stepOf("paid-order")).toMatchObject({ kind: "node", step: "sales.order-paid", loop: "pay" })
    })

    it("round 1 not about a sale tells the team the route and the words inside the round, then ends not-sale (R41 Q10)", () => {
        expect(stepOf("not-sale-notice")).toMatchObject({ kind: "node", step: "sales.not-sale-notice", loop: "talk" })
        expect(stepOf("not-sale-said")).toMatchObject({ kind: "if", routes: { yes: "not-sale", no: "ready-said" } })
        const params = JSON.stringify((stepOf("not-sale-notice") as { params: unknown }).params)
        expect(params).toContain('"$ref":"trigger.data.conversationId"')
        expect(params).toContain('"$ref":"trigger.data.text"')
    })

    it("ends paid (after the after-sale is called with the order's id and code) or unpaid; a cancel keeps its road", () => {
        expect(salesConsultGraph.spec.outcomes.map((end) => end.key).toSorted()).toEqual(["declined", "not-sale", "paid", "quiet", "unpaid"])
        expect(stepOf("to-after-sale")).toMatchObject({ kind: "call-workflow", next: "paid" })
        const handed = JSON.stringify((stepOf("to-after-sale") as { params: unknown }).params)
        expect(handed).toContain("steps.create-order.output.orderId")
        expect(handed).toContain("steps.create-order.output.orderNo")
        expect(stepOf("cancel-said")).toMatchObject({ routes: { yes: "cancel-read", no: "quiet" } })
        expect(stepOf("cancel-paid")).toMatchObject({ routes: { yes: "cancel-paid-notice", no: "cancel-order" } })
        expect(stepOf("cancel-paid-notice")).toMatchObject({ step: "sales.cancel-paid-notice", next: "quiet" })
        expect(stepOf("cancel-order")).toMatchObject({ next: "tell-cancelled" })
        expect(stepOf("tell-cancelled")).toMatchObject({ next: "quiet" })
    })
})

// R68: what the ENGINE tells the team, and where the run goes after, as each step declares it. One post per ending, as the notice nodes
// of v25-v29 posted one: the same endings, the same outcomes.
describe("sales.consult v30: the engine reports the unsuccessful endings (R68)", () => {
    const ORDER = { label: { vi: "Mã đơn", en: "Order" }, value: { $ref: "steps.create-order.output.orderNo", default: null } }
    const TOTAL = { label: { vi: "Tổng tiền", en: "Total" }, value: { $ref: "steps.create-order.output.amountVnd", default: null } }

    it.each([
        // A declined answer of the consult (was `declined-said` -> `consult-declined-notice` -> declined).
        ["consult", { then: "end", outcome: "declined", facts: [] }],
        // A declined order record: no order, the customer has no code (was `create-declined` -> notice -> declined).
        ["create-order", { then: "end", outcome: "declined", facts: [] }],
        // A declined order message (was `tell-declined` -> notice with the order's code -> declined).
        ["tell-order", { then: "end", outcome: "declined", facts: [ORDER] }],
        // A declined paid record (R41 Q8; was the `declined` leg of the pay `until`, `paid-declined` -> notice -> declined).
        ["paid-order", { then: "end", outcome: "declined", facts: [ORDER] }],
        // A declined cancel (was `cancel-declined` -> notice -> declined); the order's code now read from its record.
        ["cancel-order", { then: "end", outcome: "declined", facts: [{ label: ORDER.label, value: { $ref: "steps.cancel-read.output.orderNo", default: null } }] }],
        // A declined cancel message (was `tell-cancelled-declined` -> notice -> declined).
        ["tell-cancelled", { then: "end", outcome: "declined", facts: [{ label: ORDER.label, value: { $ref: "steps.cancel-order.output.orderNo", default: null } }] }],
        // The dates kept on the side: declined, the sale goes on (was `keep-occasions-declined` -> notice -> `not-sale-said`).
        ["keep-occasions", { then: "continue", facts: [] }],
        // An order answer or a reminder that did not reach the customer: the wait goes on (R45, R47; was `*-sent` -> unsent notice).
        ["order-talk", { then: "continue", facts: [ORDER] }],
        ["remind", { then: "continue", facts: [ORDER] }],
    ])("%s declares its ending", (key, unsuccessful) => {
        expect(stepOf(key)).toMatchObject({ unsuccessful })
    })

    it("the payment loop out of rounds tells the team the order and its total, then ends unpaid (R45; was `unpaid-notice`)", () => {
        expect(stepOf("pay")).toMatchObject({ routes: { exhausted: "unpaid" }, unsuccessful: { facts: [ORDER, TOTAL] } })
    })

    it("the talk loop running out ends quiet with NO notice (a customer going quiet is normal, R45)", () => {
        expect(stepOf("talk")).toMatchObject({ routes: { exhausted: "quiet" } })
        expect(stepOf("talk")).not.toHaveProperty("unsuccessful")
    })

    it("the steps the order's road reads past a declined record see the recorded order: the decline never goes on (the engine ends it)", () => {
        // The save check proves it (importing the graph compiled it): `request-qr` reads the order's code as a text, which the declined form has not.
        const declined = exampleOutput(salesOrderCreateNode.examples, (output) => output["declined"] === true)
        expect(declined["orderNo"]).toBeNull()
        expect(JSON.stringify((stepOf("request-qr") as { params: unknown }).params)).toContain("steps.create-order.output.orderNo")
    })
})

// The owner's target (R68): business steps and two loops; no edge branch may grow back silently.
describe("sales.consult v30: the business shape", () => {
    /** The most steps the sale may hold (v30 has 35: v29 had 55). */
    const STEPS_MAX = 35

    it("holds two until loops, two waits, two hand-backs and at most 35 steps", () => {
        expect(steps.filter((step) => step.kind === "loop").map((step) => step.key)).toEqual(["talk", "pay"])
        expect(steps.filter((step) => step.kind === "wait").map((step) => step.key)).toEqual(["hear", "await"])
        expect(steps.filter((step) => step.kind === "hand-back").map((step) => step.key)).toEqual(["give-back-talk", "give-back"])
        expect(steps.length).toBeLessThanOrEqual(STEPS_MAX)
    })

    it("draws no generic team notice and no condition on a step's declined or refused answer: the engine reports those", () => {
        expect(steps.filter((step) => step.kind === "node" && step.step.startsWith("team.")).map((step) => step.key)).toEqual([])
        const edgeTests = steps
            .filter((step) => step.kind === "if" || step.kind === "loop")
            .flatMap((step) => refsOf(step.params).map((ref) => `${step.key}<-${ref}`))
            .filter((read) => /\.output\.(declined|refusal|sent)$/u.test(read))
        expect(edgeTests).toEqual([])
    })

    it("names every condition, wait, loop, hand-back and outcome in both languages (the map never shows a generic word or a key)", () => {
        const unnamed = steps
            .filter((step) => step.kind === "if" || step.kind === "wait" || step.kind === "loop" || step.kind === "hand-back" || step.kind === "outcome")
            .filter((step) => !("label" in step) || step.label === undefined || !("vi" in step.label) || step.label.vi === "" || step.label.en === "")
            .map((step) => step.key)
        expect(unnamed).toEqual([])
        expect(salesConsultGraph.spec.outcomes.every((end) => end.title !== undefined)).toBe(true)
        expect(stepOf("pay")).toMatchObject({ exits: { until: { vi: "Thoát khi đơn đã trả" }, exhausted: { vi: "Hết 6 vòng mà chưa trả" } } })
        expect(stepOf("exact")).toMatchObject({ label: { vi: "Đủ tiền?" } })
    })
})

// MX-CORE DEF-2 / DEF-3 (P-FIX2, 2026-11-14): the `off` road on the matrix lines C-08 (round 1) and C-10 (round 3), run on the stored
// conditions with the consult's own outputs for exactly those two lines (the node's C-08 and C-10 examples), in the round each came in.
describe("sales.consult v30: the `off` road on the matrix lines C-08 (round 1) and C-10 (round 3)", () => {
    const named = (part: string): Record<string, JsonValue> => {
        const found = salesConsultTurnNode.examples.find((example) => example.name.includes(part))
        if (found === undefined || !("output" in found)) throw new Error(`no example ${part}`)
        return found.output as Record<string, JsonValue>
    }
    const firstOff = named("(MX-CORE C-08)")
    const laterOff = named("(MX-CORE C-10)")

    it("C-08, round 1: the consult's `off` ends the talk, `off-round` takes the notice (team told), and the run ends `not-sale`", () => {
        expect(firstOff).toMatchObject({ branch: "off", reply: null })
        expect(exprHolds(conditionOf("talk", "until"), readerOf({ steps: { consult: { output: firstOff } } }))).toBe(true)
        expect(exprHolds(conditionOf("off-round", "when"), readerOf({ item: { $round: 1 } }))).toBe(true)
        const told = exampleOutput(salesNotSaleNoticeNode.examples, (output) => output["posted"] === true)
        expect(exprHolds(conditionOf("not-sale-said", "when"), readerOf({ steps: { talk: { output: { rounds: 1, stopped: true, last: told } } } }))).toBe(true)
    })

    it("C-10, round 3: the consult's `off` (draft kept) does not end the talk; `off-round` hands the line back and the sale waits again", () => {
        expect(laterOff).toMatchObject({ branch: "off", reply: null, address: "25 Nguyen Hue" })
        expect(exprHolds(conditionOf("talk", "until"), readerOf({ steps: { consult: { output: laterOff }, hear: { output: { trigger: "zalo" } } } }))).toBe(false)
        expect(exprHolds(conditionOf("off-round", "when"), readerOf({ item: { $round: 3 } }))).toBe(false)
        // The next round's consult goes on from this draft (`round: "previous"`): the off turn carries the draft it was given.
        expect(laterOff["items"]).toEqual([expect.objectContaining({ quantity: 2 })])
    })
})

describe("sales.consult v30: the stored conditions against the outputs the nodes and the engine record", () => {
    const off = exampleOutput(salesConsultTurnNode.examples, (output) => output["branch"] === "off")
    const asked = exampleOutput(salesConsultTurnNode.examples, (output) => output["branch"] === "asked")
    const told = exampleOutput(salesNotSaleNoticeNode.examples, (output) => output["posted"] === true)
    const unposted = exampleOutput(salesNotSaleNoticeNode.examples, (output) => output["posted"] === false)
    /** The loop output of a talk that stopped after `rounds` rounds, its final round ended by the step that answered `last`. */
    const talk = (last: JsonValue, rounds = 1): JsonValue => ({ rounds, stopped: true, last })

    it("round 1 judged not about a sale: the talk ends, the round ended on the notice, and not-sale-said takes it to `not-sale`", () => {
        expect(exprHolds(conditionOf("talk", "until"), readerOf({ steps: { consult: { output: off } } }))).toBe(true)
        expect(exprHolds(conditionOf("not-sale-said", "when"), readerOf({ steps: { talk: { output: talk(told) } } }))).toBe(true)
        // A notice the team chat refused still ends the run `not-sale` (the refusal is in its output; the engine logs it, R45).
        expect(exprHolds(conditionOf("not-sale-said", "when"), readerOf({ steps: { talk: { output: talk(unposted) } } }))).toBe(true)
    })

    it("a talk that ended otherwise is no not-sale: the hear timeout, a consult that settled, or an if-step's own output", () => {
        const when = conditionOf("not-sale-said", "when")
        expect(exprHolds(when, readerOf({ steps: { talk: { output: talk({ trigger: "timeout" }, 3) } } }))).toBe(false)
        expect(exprHolds(when, readerOf({ steps: { talk: { output: talk({ ...asked, branch: "ready" }, 2) } } }))).toBe(false)
        expect(exprHolds(when, readerOf({ steps: { talk: { output: talk({ branch: "yes" }) } } }))).toBe(false)
    })

    it("a later round's `off` (a wait ran) and an `asked` turn do not end the talk; `ready`, `cancel` and the hear timeout do", () => {
        const until = conditionOf("talk", "until")
        const waited = { hear: { output: { trigger: "zalo" } } }
        expect(exprHolds(until, readerOf({ steps: { consult: { output: off }, ...waited } }))).toBe(false)
        expect(exprHolds(until, readerOf({ steps: { consult: { output: asked }, ...waited } }))).toBe(false)
        expect(exprHolds(until, readerOf({ steps: { consult: { output: { ...asked, branch: "ready" } }, ...waited } }))).toBe(true)
        expect(exprHolds(until, readerOf({ steps: { consult: { output: { ...asked, branch: "cancel" } }, ...waited } }))).toBe(true)
        expect(exprHolds(until, readerOf({ steps: { hear: { output: { trigger: "timeout" } } } }))).toBe(true)
    })

    it("the talk's last word routes the sale: ready records the order, cancel takes the cancel road, the rest ends quiet", () => {
        const last = (branch: string): ReturnType<typeof readerOf> => readerOf({ steps: { talk: { output: talk({ ...asked, branch }) } } })
        expect(exprHolds(conditionOf("ready-said", "when"), last("ready"))).toBe(true)
        expect(exprHolds(conditionOf("ready-said", "when"), last("cancel"))).toBe(false)
        expect(exprHolds(conditionOf("cancel-said", "when"), last("cancel"))).toBe(true)
        expect(exprHolds(conditionOf("cancel-said", "when"), last("asked"))).toBe(false)
    })

    it("a paid record (the paid step's real answer) ends the payment loop and goes on to the after-sale", () => {
        const paid = exampleOutput(salesOrderPaidNode.examples, (output) => output["declined"] === false)
        expect(exprHolds(conditionOf("pay", "until"), readerOf({ steps: { "paid-order": { output: paid } } }))).toBe(true)
        expect(exprHolds(conditionOf("pay", "until"), readerOf({ steps: {} }))).toBe(false)
    })

    it("a credit of the exact total records the order paid, another total takes the short road (the credit read's real answer)", () => {
        const credit = exampleOutput(salesCreditReadNode.examples, (output) => typeof output["amountVnd"] === "number")
        const amount = credit["amountVnd"]
        const order = (amountVnd: JsonValue): Record<string, JsonValue> => ({ "create-order": { output: { amountVnd } }, credit: { output: credit } })
        expect(exprHolds(conditionOf("exact", "when"), readerOf({ steps: order(amount ?? null) }))).toBe(true)
        expect(exprHolds(conditionOf("exact", "when"), readerOf({ steps: order(Number(amount) + 1000) }))).toBe(false)
    })

    it("a cancel of a paid order tells the team, of an unpaid one (the order read's real answers) cancels it", () => {
        const statuses = salesOrderReadNode.examples.flatMap((example) => ("output" in example ? [(example.output as Record<string, JsonValue>)["status"]] : []))
        expect(statuses.length).toBeGreaterThan(0)
        const when = conditionOf("cancel-paid", "when")
        expect(exprHolds(when, readerOf({ steps: { "cancel-read": { output: { status: "paid" } } } }))).toBe(true)
        for (const status of statuses.filter((one) => one !== "paid")) expect(exprHolds(when, readerOf({ steps: { "cancel-read": { output: { status } } } }))).toBe(false)
    })
})
