import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { callInputsOf } from "@nivo-lite/agent-sdk/graph"
import type { StoredExpr, StoredRef } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { exprHolds } from "@nivo-lite/agent-sdk/template"
import { salesConsultTurnNode } from "../../../nodes/sales/consult-turn.node"
import { salesNotSaleNoticeNode } from "../../../nodes/sales/not-sale-notice.node"
import { salesOrderPaidNode } from "../../../nodes/sales/order-paid.node"
import { salesPaymentRemindNode } from "../../../nodes/sales/payment-remind.node"
import { salesOrderTalkNode } from "../../../nodes/sales/order-talk.node"
import { salesConsultGraph } from "./consult.graph"

// The SALE AS ONE RUN (owner's final rule 7, 2026-11-14): this spec replaces the version-19 consult spec (one consult turn per run, the
// reminder armed as a timer). Design change, stated: the talk, the order and the payment wait are one graph; the reminder is the payment
// wait's timeout; no `recentLines` is handed in. Importing the graph builds it: reaching here means every save check holds.
// Design change v24 (coordinator rulings R32, R33): each round of the talk starts with the wait (round 1, which has no event, skips it);
// ONE consult reads THAT round's message; `off` hands it back in a round that waited, ends `not-sale` in round 1; the payment wait takes
// money IN only and a credit off the total tells the team too.
// Design change v25 (coordinator ruling R41): an unhandled case is never silent. Q10: round 1 judged not about a sale tells the team the
// route and the words before the run ends `not-sale`. Q8: a person declining the paid record ends the payment loop (the old `until` read
// `orderId`, which the paid step answers even on a decline, so a declined record was taken for paid), tells the team, ends `declined`.
// v26 (S5c's world sale-edges, coordinator 2026-11-14): v25's `not-sale-said` tested `last.branch` ABSENT, but the loop's `last` is the
// consult that ended round 1, whose real answer carries `branch: "off"`: a first line not about buying still ended quietly. The test is
// now `last.branch == off`; the cases below evaluate the stored conditions against the nodes' OWN example outputs, not hand-made shapes.

describe("sales.consult: the sale as one run", () => {
    const steps = salesConsultGraph.spec.nodes
    const stepOf = (key: string): unknown => steps.find((step) => step.key === key)

    // v28 (ruling R45): the hand-off also carries the visit's start (`since`): the consult reads the engine's thread itself.
    it("is version 29, called by the front desk with the route, the words, the channel, the person and the visit's start (no recentLines)", () => {
        expect(salesConsultGraph.key).toBe("sales.consult")
        expect(salesConsultGraph.spec.catalogue?.version).toBe(29)
        expect(salesConsultGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(callInputsOf(salesConsultGraph.spec.contract).map((one) => one.name).toSorted()).toEqual(["channel", "contactId", "conversationId", "since", "text"])
        const consult = JSON.stringify((stepOf("consult") as { params: unknown }).params)
        expect(consult).toContain('"$ref":"trigger.data.since"')
        expect(consult).not.toContain("recentLines")
    })

    it("talks in a loop of at most 30 rounds: round 1 consults the hand-off, later rounds wait for the person's next message first", () => {
        expect(stepOf("talk")).toMatchObject({ kind: "loop", params: { mode: "until", max: 30 }, next: "settled", routes: { exhausted: "quiet" } })
        expect(stepOf("opening")).toMatchObject({ kind: "if", loop: "talk", params: { when: { op: "eq", ref: { $ref: "item.$round" }, value: 1 } }, routes: { yes: "consult", no: "hear" } })
        expect(stepOf("hear")).toMatchObject({ kind: "wait", step: "core.wait", loop: "talk", routes: { zalo: "consult", telegram: "consult" } })
        expect(steps.filter((step) => "step" in step && step.step === "sales.consult-turn").map((step) => step.key)).toEqual(["consult"])
        // Only the draft comes from the round before (R13); the message is this round's.
        expect(JSON.stringify(stepOf("consult"))).toContain('"round":"previous"')
        expect(JSON.stringify((stepOf("consult") as { params: unknown }).params)).toContain('"$ref":"steps.hear.output.event.data.text","default":null}')
        // Not about a sale: handed back in a round that waited; round 1 ends the talk.
        expect(stepOf("consult")).toMatchObject({ routes: { off: "off-round" } })
        expect(stepOf("off-round")).toMatchObject({ kind: "if", routes: { yes: "not-sale-notice", no: "give-back-talk" } })
        expect(stepOf("give-back-talk")).toEqual({ kind: "hand-back", key: "give-back-talk", loop: "talk", step: "core.hand-back", params: { wait: "hear" } })
    })

    it("the payment wait takes money IN only, and a credit off the total tells the customer and the team (R32)", () => {
        expect(JSON.stringify(stepOf("await"))).toContain('{"param":"data.direction","op":"equals","value":"in"}')
        expect(stepOf("short")).toMatchObject({ next: "short-notice" })
        expect(stepOf("short-notice")).toMatchObject({ kind: "node", step: "sales.credit-notice", loop: "pay" })
    })

    it("records the order, sends the QR and tells the customer, then waits for the money in a loop of at most 6 rounds", () => {
        expect(stepOf("create-order")).toMatchObject({ step: "sales.order-create" })
        expect(stepOf("tell-declined")).toMatchObject({ kind: "if", routes: { no: "pay" } })
        // v28 (ruling R45): running out of rounds tells the team the order and its total before `unpaid`.
        expect(stepOf("pay")).toMatchObject({ kind: "loop", params: { mode: "until", max: 6 }, next: "paid-declined", routes: { exhausted: "unpaid-notice" } })
        expect(stepOf("unpaid-notice")).toMatchObject({ kind: "node", step: "sales.unpaid-notice", next: "unpaid" })
        const told = JSON.stringify((stepOf("unpaid-notice") as { params: unknown }).params)
        expect(told).toContain("steps.create-order.output.orderNo")
        expect(told).toContain("steps.create-order.output.amountVnd")
        expect(stepOf("paid-declined")).toMatchObject({ kind: "if", routes: { yes: "paid-declined-notice", no: "to-after-sale" } })
        const routes = (stepOf("await") as { routes: Record<string, string> }).routes
        expect(routes).toMatchObject({ credit: "credit", zalo: "order-talk", timeout: "remind" })
    })

    it("the talk loop running out ends quiet with no notice (a customer going quiet is normal, R45)", () => {
        expect(stepOf("talk")).toMatchObject({ routes: { exhausted: "quiet" } })
        expect(stepOf("quiet")).toMatchObject({ kind: "outcome" })
    })

    it("a message during the payment wait goes to order-talk, routed by meaning; the reminder is the wait's timeout", () => {
        expect(stepOf("order-talk")).toMatchObject({ kind: "node", step: "sales.order-talk", loop: "pay" })
        // `off` (not about the order) hands the event the payment wait took back: the front desk gets the message (R11).
        expect(stepOf("order-talk")).toMatchObject({ routes: { off: "give-back" } })
        expect(stepOf("give-back")).toEqual({ kind: "hand-back", key: "give-back", loop: "pay", step: "core.hand-back", params: { wait: "await" } })
        expect(stepOf("remind")).toMatchObject({ kind: "node", step: "sales.payment-remind", loop: "pay" })
        expect(stepOf("paid-order")).toMatchObject({ kind: "node", step: "sales.order-paid", loop: "pay" })
        expect(steps.some((step) => step.key === "arm-reminder")).toBe(false)
    })

    // v28 (S5d's world on v27): the notice moved INTO round 1 (it ends the round), so the run's `last` is a node step's output.
    it("round 1 not about a sale tells the team the route and the words inside the round, then ends not-sale (R41 Q10)", () => {
        expect(stepOf("not-sale-notice")).toMatchObject({ kind: "node", step: "sales.not-sale-notice", loop: "talk" })
        expect(stepOf("not-sale-said")).toMatchObject({ kind: "if", routes: { yes: "not-sale", no: "ready-said" } })
        const params = JSON.stringify((stepOf("not-sale-notice") as { params: unknown }).params)
        expect(params).toContain('"$ref":"trigger.data.conversationId"')
        expect(params).toContain('"$ref":"trigger.data.text"')
    })

    it("a declined paid record ends the payment loop, tells the team which order and ends declined (R41 Q8)", () => {
        const until = JSON.stringify((stepOf("pay") as { params: unknown }).params)
        expect(until).toContain("steps.paid-order.output.declined")
        expect(until).toContain("steps.paid-order.output.orderNo")
        expect(until).not.toContain("steps.paid-order.output.orderId")
        expect(stepOf("paid-declined-notice")).toMatchObject({ kind: "node", step: "team.declined-notice", next: "declined" })
        expect(JSON.stringify((stepOf("paid-declined-notice") as { params: unknown }).params)).toContain("steps.create-order.output.orderNo")
    })

    it("ends paid (after the after-sale is called) or unpaid; a cancel and a declined send keep their roads", () => {
        expect(salesConsultGraph.spec.outcomes.map((end) => end.key).toSorted()).toEqual(["declined", "not-sale", "paid", "quiet", "unpaid"])
        expect(stepOf("to-after-sale")).toMatchObject({ kind: "call-workflow", next: "paid" })
        expect(stepOf("cancel-read")).toMatchObject({ step: "sales.order-read" })
    })
})

/** The stored condition of an if-step, or the `until` of a loop. */
const conditionOf = (key: string, member: "when" | "until"): StoredExpr => {
    const step = salesConsultGraph.spec.nodes.find((one) => one.key === key) as { readonly params: Readonly<Record<string, StoredExpr>> } | undefined
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

// v28 (S5d's world `sale-edges` on v27, measured): the engine's until-loop output is `{ rounds, stopped, last }` with `last` = the output of
// the step that ENDED the final round, an if-step included: on v27 round 1's `off` ended on `off-round`, so `last` was `{ branch: "yes" }`
// and `not-sale-said` (testing the consult's `off`) never fired. v26's spec fed `last` the consult's output, a shape no run has. These
// cases feed `last` exactly what the engine records for each road (the round-ending step's own output, from the nodes' examples).
describe("sales.consult v28: the stored conditions against the loop output the engine records", () => {
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

    it("a later round's `off` (a wait ran) does not end the talk: its message is handed back", () => {
        expect(exprHolds(conditionOf("talk", "until"), readerOf({ steps: { consult: { output: off }, hear: { output: { trigger: "zalo" } } } }))).toBe(false)
    })

    it("a declined paid record (the paid step's real decline answer) ends the payment loop, tells the team and ends declined (R41 Q8)", () => {
        const declined = exampleOutput(salesOrderPaidNode.examples, (output) => output["declined"] === true)
        expect(exprHolds(conditionOf("pay", "until"), readerOf({ steps: { "paid-order": { output: declined } } }))).toBe(true)
        expect(exprHolds(conditionOf("paid-declined", "when"), readerOf({ steps: { pay: { output: { last: declined } } } }))).toBe(true)
        const steps = salesConsultGraph.spec.nodes
        expect(steps.find((one) => one.key === "paid-declined")).toMatchObject({ routes: { yes: "paid-declined-notice" } })
        expect(steps.find((one) => one.key === "paid-declined-notice")).toMatchObject({ next: "declined" })
        expect(salesConsultGraph.spec.outcomes.some((end) => end.key === "declined")).toBe(true)
    })

    it("a paid record (the paid step's real answer) ends the loop and goes on to the after-sale, never to the decline notice", () => {
        const paid = exampleOutput(salesOrderPaidNode.examples, (output) => output["declined"] === false)
        expect(exprHolds(conditionOf("pay", "until"), readerOf({ steps: { "paid-order": { output: paid } } }))).toBe(true)
        expect(exprHolds(conditionOf("paid-declined", "when"), readerOf({ steps: { pay: { output: { last: paid } } } }))).toBe(false)
    })
})

// v27 (Opus-3g review, law "never silent"): a person declining the side step that keeps the dates ended the run `declined` with no team
// notice, before a `ready` talk's order was recorded. Now the team is told and the sale goes on where the talk left it.
describe("sales.consult v27: the dates side step", () => {
    it("a declined keep of the dates tells the team and goes on to the sale's own roads", () => {
        const steps = salesConsultGraph.spec.nodes
        expect(steps.find((one) => one.key === "keep-occasions-declined")).toMatchObject({ routes: { yes: "keep-occasions-declined-notice", no: "not-sale-said" } })
        expect(steps.find((one) => one.key === "keep-occasions-declined-notice")).toMatchObject({ step: "team.declined-notice", next: "not-sale-said" })
    })
})

// v28 (ruling R45, law "never silent"): an answer about the order whose send was refused or declined ended the round with nobody told. Now
// the team is told (the step, the order, the refusal) and the wait goes on; a send refused under a staff hold (`route_held`) stays quiet.
describe("sales.consult v28: an order answer that did not reach the customer", () => {
    const steps = salesConsultGraph.spec.nodes
    const sent = exampleOutput(salesOrderTalkNode.examples, (output) => output["topic"] === "about")
    const when = conditionOf("order-talk-sent", "when")
    const holds = (output: Record<string, JsonValue>): boolean => exprHolds(when, readerOf({ steps: { "order-talk": { output } } }))

    it("order-talk's `about` goes to the sent check, whose yes is the team notice; both end the round", () => {
        expect(steps.find((one) => one.key === "order-talk")).toMatchObject({ routes: { about: "order-talk-sent", off: "give-back" } })
        expect(steps.find((one) => one.key === "order-talk-sent")).toMatchObject({ kind: "if", loop: "pay", routes: { yes: "order-talk-unsent-notice" } })
        expect(steps.find((one) => one.key === "order-talk-unsent-notice")).toMatchObject({ kind: "node", step: "team.unsent-notice", loop: "pay" })
        const params = JSON.stringify((steps.find((one) => one.key === "order-talk-unsent-notice") as { params: unknown }).params)
        expect(params).toContain("steps.create-order.output.orderNo")
        expect(params).toContain("steps.order-talk.output.refusal")
    })

    it("a delivered answer (order-talk's real output) tells nobody; a refused or declined one tells the team; `route_held` stays quiet", () => {
        expect(holds(sent)).toBe(false)
        expect(holds({ ...sent, sent: false, refusal: "outside_window" })).toBe(true)
        expect(holds({ ...sent, sent: false, refusal: "declined" })).toBe(true)
        expect(holds({ ...sent, sent: false, refusal: "route_held" })).toBe(false)
    })
})

// v29 (ruling R47, law "never silent"): a payment reminder the engine refused (`outside_window` after Zalo's reply window, an opted-out
// customer) ended the round with nobody told. Same pair as `order-talk`: the team is told (the step, the order, the refusal); `route_held` stays quiet.
describe("sales.consult v29: a payment reminder that did not reach the customer", () => {
    const steps = salesConsultGraph.spec.nodes
    const delivered = exampleOutput(salesPaymentRemindNode.examples, (output) => output["sent"] === true)
    const when = conditionOf("remind-sent", "when")
    const holds = (output: Record<string, JsonValue>): boolean => exprHolds(when, readerOf({ steps: { remind: { output } } }))

    it("remind goes to the sent check, whose yes is the team notice; both end the round", () => {
        expect(steps.find((one) => one.key === "remind")).toMatchObject({ kind: "node", next: "remind-sent", loop: "pay" })
        expect(steps.find((one) => one.key === "remind-sent")).toMatchObject({ kind: "if", loop: "pay", routes: { yes: "remind-unsent-notice" } })
        expect(steps.find((one) => one.key === "remind-unsent-notice")).toMatchObject({ kind: "node", step: "team.unsent-notice", loop: "pay" })
        const params = JSON.stringify((steps.find((one) => one.key === "remind-unsent-notice") as { params: unknown }).params)
        expect(params).toContain("steps.create-order.output.orderNo")
        expect(params).toContain("steps.remind.output.refusal")
    })

    it("a delivered reminder tells nobody; a refused one tells the team; `route_held` stays quiet", () => {
        expect(holds({ sent: true, refusal: null })).toBe(false)
        expect(holds({ ...delivered, sent: true, refusal: null })).toBe(false)
        expect(holds({ sent: false, refusal: "outside_window" })).toBe(true)
        expect(holds({ sent: false, refusal: "route_held" })).toBe(false)
    })
})
