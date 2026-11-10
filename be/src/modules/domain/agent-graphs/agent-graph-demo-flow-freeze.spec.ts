import { TOOL } from "@nivo-lite/blocks-core"
import {
    ACCOUNTING,
    CHATBOT,
    CONVERSATION,
    MATCH_PURPOSE,
    ORDER_NO,
    QR_URL,
    SALES_OWNER,
    TRANSFER_CODE,
    agrees,
    answers,
    catalogueRow,
    closingStore,
    confusedBy,
    creditWake,
    customerSays,
    paysOrder,
    play,
    rowsOf,
    understands,
} from "@tests/fixtures/builders/demo-flow-shop.builder"
import type { FlowModelScript } from "@tests/fixtures/builders/flow-f-world.builder"
import { teamLineOf } from "@tests/fixtures/builders/flow-f-world.builder"
import { freezingShopOf } from "@tests/fixtures/builders/lead-freeze-shop.builder"
import type { FreezingShop } from "@tests/fixtures/builders/lead-freeze-shop.builder"
import { CREATE_ORDER_PURPOSE, createsOrder } from "@tests/fixtures/builders/sales-flow-cases.builder"
import words from "@tests/fixtures/builders/demo-flow-shop.words.json"
import type { LeadFreeze } from "@modules/domain/lead-freezes"

// The demo flow of the live incident, with the engine's freeze of ONE workflow of a customer whose run stopped for good: the QR is sent,
// the customer says they paid, the front desk hands their words to Accounting, and the claim's executor is missing, so the reconcile run
// stops at its match step. The reconcile workflow of that customer waits for the founder; the front desk still serves them. The real
// gate of the flows, the real freeze service and its real runs, items and wakes run over the in-memory shop; nothing reaches a bank.

/** The reconcile workflow of the shop's Accounting agent: the one the incident freezes for the customer. */
const RECONCILE = `${ACCOUNTING}:reconcile`

/** The call that records the customer's word that they paid: a claim, never proof. */
const RECORD_CLAIM = {
    call: {
        tool: TOOL.paymentClaimRecord,
        args: { leadId: "lead-1", conversationId: CONVERSATION, amountVnd: 450_000, names: [], body: words.paidSaid },
    },
}

/** The agent of the match while the claim cannot be recorded: the call comes back as a refusal, it cannot go on and says so. */
const claimFails = (): FlowModelScript => ({
    [MATCH_PURPOSE]: [RECORD_CLAIM, confusedBy(words.claimReason, words.claimAsk)],
})

/** The turns the same agent takes when the step runs again: the claim is recorded, the money has not arrived yet. */
const CLAIM_RECORDED = [
    RECORD_CLAIM,
    {
        done: {
            transactionId: null,
            orderId: "order-1",
            claimId: "payment-claim-1",
            settle: false,
            reason: words.claimWaiting,
        },
    },
]

/** The SePay credit that carries the order's transfer code. */
const CREDIT = {
    id: "tx-sepay-1",
    amountVnd: 450_000,
    reference: `${TRANSFER_CODE} NGUYEN VAN A chuyen khoan`,
    payer: "NGUYEN VAN A",
    occurredAt: "2026-11-04T10:05:00.000Z",
    orderId: null,
    status: "new",
}

/** A shop as it stands once the reconcile run stopped for good, with how many lines were sent before, and the model of its Accounting agent. */
interface FrozenShop {
    readonly shop: FreezingShop
    readonly sentAfterQr: number
    readonly accounting: FlowModelScript
}

/** A shop whose customer was sent the QR, then said they paid while the claim's executor is missing: the reconcile run stopped for good. */
const frozenShop = async (): Promise<FrozenShop> => {
    const shop = freezingShopOf(closingStore())
    await customerSays(shop, words.agreeSaid, { front: {}, sales: agrees() })
    const sentAfterQr = shop.sent.length
    shop.missing.add(TOOL.paymentClaimRecord)
    const accounting = claimFails()
    await customerSays(shop, words.paidSaid, { front: understands("paid"), accounting })
    return { shop, sentAfterQr, accounting }
}

const freezeOf = (shop: FreezingShop): LeadFreeze | undefined => [...shop.freezes.records.values()][0]

/** What the team was told in the team chat, in order. */
const teamTold = (shop: FreezingShop): ReadonlyArray<string> =>
    shop.world.ran.filter((each) => each.effect === TOOL.teamMessagePost).map((each) => teamLineOf(each.payload))

/** The one shop the sequence of the incident runs against, stage after stage. */
const today = frozenShop()

describe("the demo flow of the incident, stage 1: the reconcile run stops for good and freezes that workflow of the customer", () => {
    it("sent the QR, stopped at the match step, told the team (never the customer) and froze the customer's reconcile workflow", async () => {
        const { shop, sentAfterQr } = await today
        expect(shop.sent.slice(0, sentAfterQr).at(-1)).toMatchObject({
            effect: TOOL.paymentQrCreate,
            payload: { orderId: "order-1", qrUrl: QR_URL },
        })
        // No coded line to the customer: a stopped run reports to the team in the team chat, with the facts.
        expect(shop.sent.slice(sentAfterQr)).toEqual([])
        expect(teamTold(shop).find((line) => line.includes("match (accounting.match-payment)"))).toContain(
            words.claimReason,
        )
        const freeze = freezeOf(shop)
        expect(freeze).toMatchObject({
            key: `lead:lead-1|wf:${RECONCILE}`,
            leadId: "lead-1",
            conversationId: CONVERSATION,
            status: "frozen",
            frozenReason: "ai_confused",
            stepKey: "match",
            stepTitle: words.matchStepTitle,
            customerName: words.customerName,
            failures: 1,
            episode: 1,
        })
        expect(shop.freezes.stopped.get(freeze?.frozenRunId ?? "")).toMatchObject({
            agentId: ACCOUNTING,
            held: true,
            status: "parked",
        })
        // The front desk did its part: it handed the customer's words to Accounting's reconcile workflow.
        expect(shop.tagged.filter((tag) => tag.toAgentId === ACCOUNTING)).toMatchObject([
            { context: { workflowCall: { workflow: "reconcile" }, params: { text: words.paidSaid } } },
        ])
        expect(rowsOf(shop.store, "payment-claim")).toEqual([])
    })

    it("freezes one workflow, not the customer: the reconcile workflow waits, the front desk and the consult do not", async () => {
        const { shop } = await today
        const of = (workflowId: string) => ({ leadId: "lead-1", conversationId: CONVERSATION, workflowId })

        await expect(shop.freezes.service.frozen("ws-1", of(RECONCILE))).resolves.toBe(true)
        await expect(shop.freezes.service.frozen("ws-1", of(`${CHATBOT}:front-desk`))).resolves.toBe(false)
        await expect(shop.freezes.service.frozen("ws-1", of(`${SALES_OWNER}:consult`))).resolves.toBe(false)
    })
})

describe("the demo flow of the incident, stage 2: the customer writes again and the SePay credit arrives", () => {
    it("still serves the customer's other messages at the front desk, whose agent is told what waits for the founder", async () => {
        const { shop } = await today
        const sentBefore = shop.sent.length

        const again = await customerSays(shop, words.hoursQuestion, {
            front: { ...understands("question"), ...answers(words.hoursAnswer) },
        })

        expect(again.front).toMatchObject({ held: false, failed: null, path: ["understand", "answer"] })
        expect(shop.sent.slice(sentBefore)).toMatchObject([{ agent: CHATBOT, payload: { text: words.hoursAnswer } }])
        // The run's trigger carries what of the customer waits, so its agents say no more than that the shop is checking.
        expect(again.front.trigger).toMatchObject({
            waitingOnFounder: [{ step: words.matchStepTitle, since: "2026-11-04T10:10:00.000Z" }],
        })
    })

    it("starts NO new run of the frozen workflow: the customer's next report of the transfer and the credit become pending events", async () => {
        const { shop } = await today
        const runsBefore = shop.runs.length

        const again = await customerSays(shop, words.stillWaiting, { front: understands("paid"), accounting: {} })
        rowsOf(shop.store, "bank-transaction").push({ ...CREDIT })
        const credit = await play(shop, { id: ACCOUNTING, module: "accounting" }, creditWake("tx-sepay-1"), {})

        // The front desk ran (its workflow is not frozen) and handed the words on; Accounting's reconcile took neither wake.
        expect(again.front).toMatchObject({ held: false, path: ["understand", "to-reconcile"] })
        expect(again.accounting).toMatchObject({ held: true, runId: null, path: [] })
        expect(credit).toMatchObject({ held: true, runId: null, path: [] })
        expect(shop.runs).toHaveLength(runsBefore + 1)
        // The transaction is kept, unmatched; the order is not paid behind the founder's back.
        expect(rowsOf(shop.store, "bank-transaction")[0]).toMatchObject({
            id: "tx-sepay-1",
            orderId: null,
            status: "new",
        })
        expect(rowsOf(shop.store, "order")[0]).toMatchObject({ status: "confirmed" })
        const pending = freezeOf(shop)?.pending ?? []
        expect(pending.map((each) => [each.kind, each.agentId])).toEqual([
            ["handoff", ACCOUNTING],
            ["payment", ACCOUNTING],
        ])
    })

    it("gave the founder ONE item for the frozen workflow, which says what each answer will do, and no review item per run", async () => {
        const { shop } = await today
        const items = rowsOf(shop.store, "work-item")
        expect(items).toHaveLength(1)
        expect(items[0]).toMatchObject({ action: "lead_frozen", status: "waiting_decision", leadId: "lead-1" })
        const summary = String(items[0]?.summary)
        expect(summary).toContain(words.frozenTitle)
        expect(summary).toContain(words.retryLabel)
        expect(summary).toContain(words.takeOverLabel)
        expect(summary).toContain(words.skipLabel)
        expect(items.filter((item) => item.action === "review_agent_run")).toEqual([])
    })
})

describe("the demo flow of the incident, stage 3: the founder retries with the executor back", () => {
    it("runs the match step again from where it stopped, records the claim, releases the workflow and replays what waited", async () => {
        const { shop, accounting } = await today
        shop.missing.delete(TOOL.paymentClaimRecord)
        accounting[MATCH_PURPOSE]?.push(...CLAIM_RECORDED)
        const freeze = freezeOf(shop)

        await expect(shop.freezes.service.retry("ws-1", freeze?.id ?? "", "owner-1")).resolves.toBe("released")

        // The run went on in context: the same run, from its failed step, with no new reading of the customer at the front desk.
        expect(shop.retried).toHaveLength(1)
        expect(shop.retried[0]).toMatchObject({ runId: freeze?.frozenRunId, path: ["match"], failed: null })
        expect(rowsOf(shop.store, "payment-claim")).toMatchObject([
            {
                leadId: "lead-1",
                conversationId: CONVERSATION,
                amountVnd: 450_000,
                body: words.paidSaid,
                status: "open",
            },
        ])
        // The money has not arrived: the match ends the turn there (`not-arrived` has no route), marking nothing paid.
        expect(shop.retried[0]?.outputs.match?.output).toMatchObject({
            branch: "not-arrived",
            claimId: "payment-claim-1",
        })
        expect(rowsOf(shop.store, "order")[0]).toMatchObject({ status: "confirmed" })
        expect(freezeOf(shop)).toMatchObject({ status: "released", releaseReason: "retried", releasedBy: "owner-1" })
        // What waited is written again as wakes, in the order it came.
        expect(shop.freezes.replayed.map((each) => each.kind)).toEqual(["handoff", "payment"])
        await expect(shop.freezes.service.frozen("ws-1", { leadId: "lead-1", workflowId: RECONCILE })).resolves.toBe(
            false,
        )
    })

    it("runs the replayed credit like any other once the workflow is released: the order is paid", async () => {
        const { shop } = await today
        const replayed = shop.freezes.replayed.find((each) => each.kind === "payment")
        const wake = { source: replayed?.source ?? "tag", actorMemberId: null, context: { ...replayed?.context } }
        const seat = { id: ACCOUNTING, module: "accounting" } as const

        const credit = await play(shop, seat, wake, paysOrder("tx-sepay-1", "order-1"))

        expect(credit).toMatchObject({ held: false, failed: null, error: null })
        expect(credit.path.slice(0, 2)).toEqual(["match", "mark-paid"])
        expect(rowsOf(shop.store, "order")[0]).toMatchObject({ status: "paid" })
        expect(rowsOf(shop.store, "bank-transaction")[0]).toMatchObject({ orderId: "order-1", status: "matched" })
    })
})

describe("the demo flow of the incident: the other two answers of the founder", () => {
    it("skipping the turn gives the failed run up, releases the workflow and replays every pending event in order", async () => {
        const { shop } = await frozenShop()
        await customerSays(shop, words.stillWaiting, { front: understands("paid"), accounting: {} })
        const freeze = freezeOf(shop)

        await expect(shop.freezes.service.skip("ws-1", freeze?.id ?? "", "owner-1")).resolves.toBe("skipped")

        expect(shop.freezes.stopped.get(freeze?.frozenRunId ?? "")?.status).toBe("dead")
        expect(freezeOf(shop)).toMatchObject({ status: "released", releaseReason: "skipped" })
        expect(shop.freezes.replayed.map((each) => each.kind)).toEqual(["handoff"])
        expect(shop.retried).toEqual([])
    })

    it("taking over hands the conversation to the founder and keeps the workflow frozen", async () => {
        const { shop } = await frozenShop()
        const freeze = freezeOf(shop)

        await expect(shop.freezes.service.takeOver("ws-1", freeze?.id ?? "", "Owner")).resolves.toBe("taken_over")

        expect(shop.freezes.heldBy.get(CONVERSATION)).toBe("Owner")
        expect(freezeOf(shop)).toMatchObject({ status: "frozen", heldBy: "Owner" })
        const again = await customerSays(shop, words.stillWaiting, { front: understands("paid"), accounting: {} })
        expect(again.accounting?.held).toBe(true)
    })
})

describe("the demo flow: an order over the owner's limit waits for the founder, then goes on", () => {
    const ORDER = {
        leadId: "lead-1",
        items: [{ catalogueItemId: "c1", quantity: 1 }],
        address: words.addressFact,
        orderId: "order-1",
        orderNo: ORDER_NO,
    }

    /** A shop whose customer settled an order of 6.000.000: the order tool will not confirm it before the founder approves. */
    const waitingShop = async () => {
        const store = closingStore()
        store["catalogue-item"] = [catalogueRow("c1", words.roseName, 6_000_000)]
        const shop = freezingShopOf(store)
        const sales: FlowModelScript = {
            ...agrees(),
            [CREATE_ORDER_PURPOSE]: [
                ...createsOrder(ORDER).slice(0, 2),
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { conversationId: CONVERSATION, text: words.limitHolding },
                    },
                },
                confusedBy(words.limitReason, words.limitAsk),
            ],
        }
        const turn = await customerSays(shop, words.agreeSaid, { front: {}, sales })
        return { shop, sales, turn }
    }

    it("stops at the create-order step on the tool's refusal and freezes the consult of the customer, the order still a draft", async () => {
        const { shop, turn } = await waitingShop()

        expect(turn.sales).toMatchObject({ failed: "create-order", path: ["consult"] })
        expect(freezeOf(shop)).toMatchObject({
            key: `lead:lead-1|wf:${SALES_OWNER}:consult`,
            status: "frozen",
            stepKey: "create-order",
            stepTitle: words.orderStepTitle,
        })
        expect(rowsOf(shop.store, "order")).toMatchObject([{ status: "draft", amountVnd: 6_000_000 }])
        expect(shop.sent).toMatchObject([{ agent: SALES_OWNER, payload: { text: words.limitHolding } }])
    })

    it("goes on to the QR once the founder approved the order and retries: the step runs again, records no second order and confirms the first", async () => {
        const { shop, sales } = await waitingShop()
        const sentBefore = shop.sent.length
        // The founder approves the order in Sales, then answers the item with "Retry".
        Object.assign(rowsOf(shop.store, "order")[0] ?? {}, { approved: true })
        sales[CREATE_ORDER_PURPOSE]?.push(...createsOrder(ORDER))

        await expect(shop.freezes.service.retry("ws-1", freezeOf(shop)?.id ?? "", "owner-1")).resolves.toBe("released")

        expect(shop.retried[0]).toMatchObject({
            failed: null,
            path: ["create-order", "send-qr", "notify-order", "won"],
        })
        // The record call was made under the same key as the first try: the ledger answers the first order, none is recorded twice.
        expect(rowsOf(shop.store, "order")).toMatchObject([
            { id: "order-1", status: "confirmed", amountVnd: 6_000_000 },
        ])
        expect(shop.world.ran.filter((each) => each.effect === TOOL.orderRecord)).toHaveLength(1)
        expect(shop.sent.slice(sentBefore)).toMatchObject([
            { effect: TOOL.paymentQrCreate, agent: SALES_OWNER, payload: { orderId: "order-1" } },
        ])
        expect(freezeOf(shop)).toMatchObject({ status: "released", releaseReason: "retried" })
    })
})
