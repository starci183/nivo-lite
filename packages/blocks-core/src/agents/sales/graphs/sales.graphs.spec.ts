import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { callInputsOf, type StoredExpr, type StoredRef } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { exprHolds, type TemplateGraph, templateGraphProblems } from "@nivo-lite/agent-sdk/template"
import { salesAfterSaleNode } from "../nodes/care-after-sale.node"
import { salesAfterSaleGraph } from "./after-sale.graph"
import { salesDeliveryCheckGraph } from "./delivery-check.graph"
import { salesOccasionGraph } from "./occasion.graph"
import { salesPaymentGraph } from "./payment.graph"
import { salesAgent } from "./sales.agent"
import { salesWebOrderGraph } from "./web-order.graph"

/**
 * The Sales care graphs and the Sales agent. Importing them is the first check: the builders throw `TemplateDefinitionError` at module
 * load with every problem decidable without the engine (refs, routes, reachability, accounts against the agent's providers).
 */

/** The published catalogue version a graph carries. */
const versionOf = (graph: TemplateGraph): number | undefined => graph.spec.catalogue?.version

/** The step keys of a graph, in the order the document lists them. */
const keysOf = (graph: TemplateGraph): ReadonlyArray<string> => graph.spec.nodes.map((step) => step.key)

/** The timer trigger of one care step, as the graphs write it: an exact `equals` on the step, never a substring. */
const timerOf = (kind: string): unknown => ({
    verb: TRIGGER.timerDue,
    where: [{ param: "data.data.kind", op: "equals", value: kind }],
})

describe("sales.after-sale", () => {
    const stepOf = (key: string): unknown => salesAfterSaleGraph.spec.nodes.find((step) => step.key === key)

    it("is version 17, called by the sale once the order is paid (no reminder left to cancel), and keeps the thank-you's key", () => {
        expect(salesAfterSaleGraph.key).toBe("sales.after-sale")
        // Version 15 (R45): a thank-you the send did not deliver tells the team. Version 16 (R49): a customer the sale keeps no record of
        // yet skips `stage`. Version 17 (R68): pure business: the engine tells the team (the `thank-unsent` pair is gone).
        expect(versionOf(salesAfterSaleGraph)).toBe(17)
        expect(salesAfterSaleGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(keysOf(salesAfterSaleGraph)).toEqual([
            "thank",
            "has-record",
            "stage",
            "plan-delivery",
            "plan-delivery-declined",
            "plan-occasions",
            "plan-occasions-declined",
            "thanked",
            "declined",
        ])
        // The caller hands the order's code too: the engine's notice of an undelivered thank-you names it.
        expect(callInputsOf(salesAfterSaleGraph.spec.contract).map((one) => one.name).toSorted()).toEqual(["contactId", "orderId", "orderNo"])
    })

    // R49 (worlds): a NEW customer's order sits under the contact alone, the thank's `leadId` is null: `stage` would stop the run `cannot`.
    it("moves the stage only when the thank-you reached the customer and the sale keeps a record of the person; else the care goes on", () => {
        expect(stepOf("thank")).toMatchObject({ kind: "node", next: "has-record" })
        expect(stepOf("has-record")).toMatchObject({ kind: "if", routes: { yes: "stage", no: "plan-delivery" } })
        expect(JSON.stringify(stepOf("has-record"))).toContain("steps.thank.output.leadId")
        expect(JSON.stringify(stepOf("has-record"))).toContain("steps.thank.output.sent")
        expect(stepOf("stage")).toMatchObject({ kind: "node", step: "sales.consult-stage", next: "plan-delivery" })
    })

    // R45 then R68: a thank-you refused or declined (not under a staff hold: the engine keeps `route_held` quiet) is told to the team by the
    // ENGINE, with the order's code; the care goes on.
    it("a thank-you that did not reach the customer is the step's unsuccessful ending: the engine tells the team the order, the care goes on", () => {
        expect(stepOf("thank")).toMatchObject({
            unsuccessful: { then: "continue", facts: [{ label: { vi: "Mã đơn", en: "Order" }, value: { $ref: "trigger.data.orderNo", default: null } }] },
        })
        expect(salesAfterSaleGraph.spec.nodes.some((step) => step.kind === "node" && step.step.startsWith("team."))).toBe(false)
    })

    it("the stored `has-record` condition: the thank's own outputs, delivered with a record, take `stage`; undelivered or with no record do not", () => {
        const step = salesAfterSaleGraph.spec.nodes.find((one) => one.key === "has-record") as { readonly params: Readonly<Record<string, StoredExpr>> }
        const reader =
            (output: Record<string, JsonValue>) =>
            (ref: StoredRef): JsonValue => {
                const member = ref.$ref.startsWith("steps.thank.output.") ? ref.$ref.slice("steps.thank.output.".length) : null
                return member === null ? (ref.default ?? null) : (output[member] ?? ref.default ?? null)
            }
        const outputs = salesAfterSaleNode.examples.map((one) => one.output as Record<string, JsonValue> | undefined)
        const delivered = outputs.find((out) => out?.["sent"] === true && out["leadId"] !== null)
        const refused = outputs.find((out) => out?.["sent"] === false && out["refusal"] !== null)
        if (delivered === undefined || refused === undefined) throw new Error("no delivered or refused example")
        expect(exprHolds(step.params["when"] as StoredExpr, reader(delivered))).toBe(true)
        expect(exprHolds(step.params["when"] as StoredExpr, reader({ ...delivered, leadId: null }))).toBe(false)
        expect(exprHolds(step.params["when"] as StoredExpr, reader(refused))).toBe(false)
    })

    it("a person declining a timer on its card ends the run `declined`, straight, with no team notice (a timer)", () => {
        expect(stepOf("plan-delivery-declined")).toMatchObject({ kind: "if", routes: { yes: "declined", no: "plan-occasions" } })
        expect(stepOf("plan-occasions-declined")).toMatchObject({ kind: "if", routes: { yes: "declined", no: "thanked" } })
        expect(stepOf("plan-delivery")).not.toHaveProperty("unsuccessful")
        expect(stepOf("plan-occasions")).not.toHaveProperty("unsuccessful")
        expect(salesAfterSaleGraph.spec.outcomes.map((end) => end.key).toSorted()).toEqual(["declined", "thanked"])
    })
})

describe("sales.delivery-check", () => {
    it("is version 10, woken by the delivery-check timer, and routes the wait to the check-in or an outcome", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        expect(versionOf(salesDeliveryCheckGraph)).toBe(10)
        expect(salesDeliveryCheckGraph.spec.triggers).toEqual([timerOf("delivery-check")])
        expect(keysOf(salesDeliveryCheckGraph)).toEqual(["wait", "check", "checked", "waiting", "closed", "declined"])
        expect(salesDeliveryCheckGraph.spec.nodes[0]).toMatchObject({
            routeBy: "route",
            routes: { due: "check", later: "waiting", closed: "closed", declined: "declined" },
        })
    })
})

describe("sales.occasion", () => {
    it("is version 11, woken by the occasion timer: the suggestion, then next year's timer", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        expect(versionOf(salesOccasionGraph)).toBe(11)
        expect(salesOccasionGraph.spec.triggers).toEqual([timerOf("occasion")])
        expect(keysOf(salesOccasionGraph)).toEqual([
            "wait",
            "suggest",
            "rearm",
            "rearm-declined",
            "greeted",
            "waiting",
            "closed",
            "declined",
        ])
        expect(salesOccasionGraph.spec.nodes[0]).toMatchObject({
            routeBy: "route",
            routes: { due: "suggest", later: "waiting", closed: "closed", declined: "declined" },
        })
        expect(salesOccasionGraph.spec.nodes.find((step) => step.key === "rearm-declined")).toMatchObject({
            kind: "if",
            routes: { yes: "declined", no: "greeted" },
        })
    })
})

describe("sales.web-order", () => {
    it("is version 9, woken by the website form's own verb: find the contact's lead, keep what it tells, then ask the team to call", () => {
        // Version 9 (R68): pure business: a declined lead is the step's unsuccessful ending (the `lead-declined` pair is gone).
        expect(versionOf(salesWebOrderGraph)).toBe(9)
        expect(salesWebOrderGraph.spec.triggers).toEqual([
            { verb: TRIGGER.websiteMessageReceived, where: [{ param: "data.request", op: "present" }] },
        ])
        expect(keysOf(salesWebOrderGraph)).toEqual(["lead", "keep", "notice", "to-owner", "declined"])
    })

    it("a website submission with a contactId tells the team: the lead is found by the contact and its id feeds keep and notice", () => {
        const stepOf = (key: string): unknown => salesWebOrderGraph.spec.nodes.find((step) => step.key === key)
        // The wake hands `contactId`, never `leadId`: the contract requires the first and no longer names the second.
        const required = salesWebOrderGraph.spec.contract.inputs.filter((one) => one.required).map((one) => one.name)
        expect(required).toContain("contactId")
        expect(salesWebOrderGraph.spec.contract.inputs.map((one) => one.name)).not.toContain("leadId")
        expect(salesWebOrderGraph.spec.nodes[0]?.key).toBe("lead")
        expect(stepOf("lead")).toMatchObject({
            step: "sales.web-order-lead",
            next: "keep",
            params: { contactId: { $ref: "trigger.contactId" }, request: { $ref: "trigger.data.request" } },
            // A person declining the record: the engine tells the team, the run ends `declined` (the visitor's request is not kept).
            unsuccessful: { then: "end", outcome: "declined", facts: [] },
        })
        expect(salesWebOrderGraph.spec.outcomes.map((end) => end.key).toSorted()).toEqual(["declined", "owner"])
        expect(stepOf("keep")).toMatchObject({ params: { leadId: { $ref: "steps.lead.output.leadId" } } })
        expect(stepOf("notice")).toMatchObject({
            step: "sales.web-order-notice",
            next: "to-owner",
            params: { leadId: { $ref: "steps.lead.output.leadId" } },
        })
    })
})

describe("sales.payment", () => {
    const stepOf = (key: string): unknown => salesPaymentGraph.spec.nodes.find((step) => step.key === key)

    it("is version 12, woken by a bank credit on the SePay, Casso or payOS feed or called with a customer's conversation", () => {
        expect(salesPaymentGraph.key).toBe("sales.payment")
        // Version 10: the front desk's unread `recentLines` is gone from the input (legacy). Version 11 (R68): pure business: the engine
        // tells the team of a declined step (the two notice nodes and `claim-reply-declined` are gone). Version 12 (P-NEXT, QUEUE-DESIGN
        // (4)): the team is told the words the reply step heard (every line since the shop last spoke), not only the hand-off's.
        expect(versionOf(salesPaymentGraph)).toBe(12)
        expect(salesPaymentGraph.spec.triggers).toEqual([
            { verb: TRIGGER.paymentCreditReceived, accounts: ["sepay", "casso", "payos"] },
            { verb: TRIGGER.workflowCalled },
        ])
        expect(keysOf(salesPaymentGraph)).toEqual([
            "source",
            "credit",
            "awaiting",
            "match",
            "named",
            "exact",
            "pay",
            "short",
            "tally",
            "paid-said",
            "pay-declined",
            "to-after-sale",
            "paid",
            "credit-notice",
            "told",
            "claim-reply",
            "claim-notice",
            "claimed",
            "declined",
        ])
    })

    it("a credit is read exactly by its row and matched in the graph's own expressions: contains the code AND equals the total", () => {
        expect(stepOf("source")).toMatchObject({ kind: "if", routes: { yes: "credit", no: "claim-reply" } })
        expect(stepOf("credit")).toMatchObject({
            step: "sales.credit-read",
            next: "awaiting",
            params: { transactionId: { $ref: "trigger.data.transactionId" } },
        })
        // Money that went out never arrives: the engine narrows the credit trigger to `direction = in`, so the graph holds no such node.
        expect(stepOf("incoming")).toBeUndefined()
        expect(stepOf("named")).toMatchObject({
            kind: "if",
            params: {
                when: { op: "contains", ref: { $ref: "steps.credit.output.content" }, value: { $ref: "item.orderNo" } },
            },
        })
        expect(stepOf("exact")).toMatchObject({
            kind: "if",
            params: { when: { op: "eq", ref: { $ref: "steps.credit.output.amountVnd" }, value: { $ref: "item.amountVnd" } } },
            routes: { yes: "pay", no: "short" },
        })
        expect(stepOf("pay")).toMatchObject({ step: "sales.order-paid" })
        expect(stepOf("short")).toMatchObject({ step: "sales.payment-short", blocking: false })
        expect(stepOf("paid-said")).toMatchObject({ kind: "if", routes: { yes: "to-after-sale", no: "pay-declined" } })
        expect(stepOf("to-after-sale")).toMatchObject({ kind: "call-workflow", params: { agent: "sales", workflow: "after-sale" } })
        expect(JSON.stringify(stepOf("to-after-sale"))).toContain("steps.tally.output.orderNo")
    })

    it("a customer's words are answered and told; nothing settles on words", () => {
        expect(stepOf("credit-notice")).toMatchObject({ step: "sales.credit-notice", blocking: false, next: "told" })
        expect(stepOf("claim-reply")).toMatchObject({ step: "sales.paid-claim-reply", next: "claim-notice" })
        expect(stepOf("claim-notice")).toMatchObject({ step: "sales.paid-claim-notice", blocking: false, next: "claimed" })
        expect(stepOf("claim-notice")).toMatchObject({ params: { text: { $ref: "steps.claim-reply.output.heard" } } })
        expect(salesPaymentGraph.spec.outcomes.map((end) => end.key).toSorted()).toEqual(["claimed", "declined", "paid", "told"])
    })

    // R68: the ENGINE tells the team (one post per declined step, as the notice nodes did), then the run ends as before.
    it("a person declining on a card is told to the team and ends `declined`: the credit left unrecorded, the customer left unanswered", () => {
        // The paid record of a matched order: told with the order's code, the match goes on; no order paid -> `declined`.
        expect(stepOf("pay")).toMatchObject({
            loop: "match",
            unsuccessful: { then: "continue", facts: [{ label: { vi: "Mã đơn", en: "Order" }, value: { $ref: "item.orderNo" } }] },
        })
        expect(stepOf("pay-declined")).toMatchObject({ kind: "if", routes: { yes: "declined", no: "credit-notice" } })
        // The answer to a customer who says they paid: told, then `declined`.
        expect(stepOf("claim-reply")).toMatchObject({ unsuccessful: { then: "end", outcome: "declined", facts: [] } })
        expect(salesPaymentGraph.spec.nodes.some((step) => step.kind === "node" && step.step.startsWith("team."))).toBe(false)
    })
})

// `sales.payment-reminder` is gone (owner final rule 7): the sale run`s payment wait times out into the reminder.

describe("the Sales agent", () => {
    it("holds the consult (primary), the care graphs and the team chat, all of the sales module", () => {
        expect(salesAgent.key).toBe("sales")
        expect(salesAgent.primary).toBe("sales.consult")
        expect(salesAgent.graphs.map((graph) => graph.key)).toEqual([
            "sales.consult",
            "sales.payment",
            "sales.after-sale",
            "sales.delivery-check",
            "sales.occasion",
            "sales.web-order",
            "sales.team-chat",
        ])
        expect(salesAgent.accounts).toEqual(["zalo_oa", "telegram", "meta", "sepay", "casso", "payos"])
    })
})

describe("strict nullability", () => {
    it.each([
        salesPaymentGraph,
        salesAfterSaleGraph,
        salesDeliveryCheckGraph,
        salesOccasionGraph,
        salesWebOrderGraph,
    ])("every ref of $key fits its site when it reads nothing", (graph) => {
        expect(templateGraphProblems(graph.spec, { nodes: graph.nodes, nullability: "strict" })).toEqual([])
    })
})
