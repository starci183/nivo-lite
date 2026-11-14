import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import type { StoredExpr, StoredRef } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { exprHolds, type TemplateGraph, templateGraphProblems } from "@nivo-lite/agent-sdk/template"
import { salesAfterSaleNode } from "../../../nodes/sales/care-after-sale.node"
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
    it("is version 16, called by the sale once the order is paid (no reminder left to cancel), and keeps the thank-you's key", () => {
        expect(salesAfterSaleGraph.key).toBe("sales.after-sale")
        // Version 15 (ruling R45): a thank-you the send did not deliver tells the team (`thank-unsent`, `thank-unsent-notice`).
        expect(versionOf(salesAfterSaleGraph)).toBe(16)
        // Version 16 (R49): a customer the sale keeps no record of yet skips `stage` (`has-record`).
        expect(salesAfterSaleGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
        expect(keysOf(salesAfterSaleGraph)).toEqual([
            "thank",
            "thanked-them",
            "has-record",
            "thank-unsent",
            "thank-unsent-notice",
            "stage",
            "plan-delivery",
            "plan-delivery-declined",
            "plan-occasions",
            "plan-occasions-declined",
            "thanked",
            "declined",
        ])
    })

    it("moves the consult stage only when the thank-you reached the customer", () => {
        const check = salesAfterSaleGraph.spec.nodes.find((step) => step.key === "thanked-them")
        expect(check).toMatchObject({ kind: "if", routes: { yes: "has-record", no: "thank-unsent" } })
    })

    // R49 (worlds): a NEW customer's order sits under the contact alone, the thank's `leadId` is null: `stage` would stop the run `cannot`.
    it("moves the stage only when the sale keeps a record of the person; a new customer skips it and the care goes on", () => {
        const stepOf = (key: string): unknown => salesAfterSaleGraph.spec.nodes.find((step) => step.key === key)
        expect(stepOf("has-record")).toMatchObject({ kind: "if", routes: { yes: "stage", no: "plan-delivery" } })
        expect(JSON.stringify(stepOf("has-record"))).toContain("steps.thank.output.leadId")
        expect(stepOf("stage")).toMatchObject({ kind: "node", step: "sales.consult-stage", next: "plan-delivery" })
    })

    // Design change (ruling R45): an after-sale ending with nothing sent because the send was refused or declined tells the team.
    it("a thank-you refused or declined (not under a staff hold) tells the team the step, the order and the refusal; the care goes on", () => {
        const stepOf = (key: string): unknown => salesAfterSaleGraph.spec.nodes.find((step) => step.key === key)
        expect(stepOf("thank-unsent")).toMatchObject({ kind: "if", routes: { yes: "thank-unsent-notice", no: "plan-delivery" } })
        expect(JSON.stringify(stepOf("thank-unsent"))).toContain('"route_held"')
        expect(stepOf("thank-unsent-notice")).toMatchObject({ kind: "node", step: "team.unsent-notice", next: "plan-delivery" })
        expect(JSON.stringify(stepOf("thank-unsent-notice"))).toContain("steps.thank.output.orderNo")
    })

    it("the stored `has-record` condition: the thank's own outputs with a record take `stage`, a new customer's (leadId null) does not", () => {
        const step = salesAfterSaleGraph.spec.nodes.find((one) => one.key === "has-record") as { readonly params: Readonly<Record<string, StoredExpr>> }
        const reader =
            (output: Record<string, JsonValue>) =>
            (ref: StoredRef): JsonValue => (ref.$ref === "steps.thank.output.leadId" ? (output["leadId"] ?? null) : (ref.default ?? null))
        const delivered = salesAfterSaleNode.examples.map((one) => one.output as Record<string, JsonValue> | undefined).find((out) => out?.["sent"] === true && out["leadId"] !== null)
        if (delivered === undefined) throw new Error("no delivered example with a record")
        expect(exprHolds(step.params["when"] as StoredExpr, reader(delivered))).toBe(true)
        expect(exprHolds(step.params["when"] as StoredExpr, reader({ ...delivered, leadId: null }))).toBe(false)
    })

    it("a person declining a timer on its card ends the run `declined`, straight, with no team notice (a timer)", () => {
        const stepOf = (key: string): unknown => salesAfterSaleGraph.spec.nodes.find((step) => step.key === key)
        expect(stepOf("plan-delivery-declined")).toMatchObject({ kind: "if", routes: { yes: "declined", no: "plan-occasions" } })
        expect(stepOf("plan-occasions-declined")).toMatchObject({ kind: "if", routes: { yes: "declined", no: "thanked" } })
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
    it("is version 8, woken by the website form's own verb: find the contact's lead, keep what it tells, then ask the team to call", () => {
        // ledger 2026-11-13 (`nivo-frame.rights`): every graph's catalogue version + 1 (one mode per node changed every compiled document).
        expect(versionOf(salesWebOrderGraph)).toBe(8)
        expect(salesWebOrderGraph.spec.triggers).toEqual([
            { verb: TRIGGER.websiteMessageReceived, where: [{ param: "data.request", op: "present" }] },
        ])
        expect(keysOf(salesWebOrderGraph)).toEqual([
            "lead",
            "lead-declined",
            "lead-declined-notice",
            "keep",
            "notice",
            "to-owner",
            "declined",
        ])
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
            next: "lead-declined",
            params: { contactId: { $ref: "trigger.contactId" }, request: { $ref: "trigger.data.request" } },
        })
        expect(stepOf("lead-declined")).toMatchObject({ kind: "if", routes: { yes: "lead-declined-notice", no: "keep" } })
        expect(stepOf("lead-declined-notice")).toMatchObject({ step: "team.declined-notice", next: "declined" })
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

    it("is version 10, woken by a bank credit on the SePay, Casso or payOS feed or called with a customer's conversation", () => {
        expect(salesPaymentGraph.key).toBe("sales.payment")
        // Version 10: the front desk's unread `recentLines` is gone from the input (legacy).
        expect(versionOf(salesPaymentGraph)).toBe(10)
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
            "pay-declined-notice",
            "to-after-sale",
            "paid",
            "credit-notice",
            "told",
            "claim-reply",
            "claim-reply-declined",
            "claim-reply-declined-notice",
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
    })

    it("a customer's words are answered and told; nothing settles on words", () => {
        expect(stepOf("credit-notice")).toMatchObject({ step: "sales.credit-notice", blocking: false, next: "told" })
        expect(stepOf("claim-reply")).toMatchObject({ step: "sales.paid-claim-reply", next: "claim-reply-declined" })
        expect(stepOf("claim-notice")).toMatchObject({ step: "sales.paid-claim-notice", blocking: false, next: "claimed" })
        expect(salesPaymentGraph.spec.outcomes.map((end) => end.key).toSorted()).toEqual(["claimed", "declined", "paid", "told"])
    })

    it("a person declining on a card is told to the team and ends `declined`: the credit left unrecorded, the customer left unanswered", () => {
        expect(stepOf("pay-declined")).toMatchObject({ kind: "if", routes: { yes: "pay-declined-notice", no: "credit-notice" } })
        expect(stepOf("pay-declined-notice")).toMatchObject({ step: "team.declined-notice", next: "declined" })
        expect(stepOf("claim-reply-declined")).toMatchObject({
            kind: "if",
            routes: { yes: "claim-reply-declined-notice", no: "claim-notice" },
        })
        expect(stepOf("claim-reply-declined-notice")).toMatchObject({ step: "team.declined-notice", next: "declined" })
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
