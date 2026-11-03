import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { Judgement } from "@nivo-lite/agent-sdk/reconcile"
import { DecisionsErrorCode, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import { OrderPaymentClaimsService, OrdersService } from "@modules/domain/orders"
import type { PaymentClaimRow, SalesOrderListRow } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    eventOf,
    itemOf,
    leadOf,
    orderOf,
    proposalOf,
    transactionOf,
} from "@tests/fixtures/builders/reconcile-payment-performer.builder"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { OrderPaymentJudgeService } from "./order-payment-judge.service"
import { OrderPaymentReconcileService } from "./order-payment-reconcile.service"
import { PerformerKitService } from "./performer-kit.service"
import { WORK_PERFORMERS_OPTIONS } from "./work-performers.decorators"
import type { WorkPerformersOptions } from "./work-performers.options"

/** 01:06 on 4 November, when SePay transaction 95958515 arrived. */
const NOW = "2026-11-04T01:06:00.000Z"
const ctx: WorkContext = { workspaceId: "ws-1", actor: "NIVO", locale: "vi" }

/** Định's order: one flower pot, 5,000, confirmed at 00:40 for the customer who wrote on Zalo at 00:54. */
const dinhOrder = (over: Partial<SalesOrderListRow> = {}): SalesOrderListRow => ({
    ...orderOf({ id: "order-dinh", lead_id: "lead-dinh", order_no: "SO-0001", items: "1 chau hoa", amount_vnd: 5000 }),
    status: "confirmed",
    confirmed_at: "2026-11-04T00:40:00.000Z",
    contact_name: "Bùi Nguyên Định",
    company: null,
    ...over,
})

/** His message of 00:54: "Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH". */
const dinhClaim = (over: Partial<PaymentClaimRow> = {}): PaymentClaimRow => ({
    id: "claim-1",
    workspaceId: "ws-1",
    leadId: "lead-dinh",
    conversationId: "conv-1",
    amountVnd: 5000,
    names: ["BUI NGUYEN DINH"],
    body: "Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH",
    claimedAt: new Date("2026-11-04T00:54:00.000Z"),
    status: "open",
    ...over,
})

/** SePay 95958515: +5000, "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940". */
const dinhCredit = eventOf({
    id: "ev-95958515",
    amount_vnd: 5000,
    external_ref: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    body: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    event_id: "sepay:95958515",
})

/** SePay 95937289: +2000, MoMo "Test Sepay", belongs to no order. */
const momoCredit = eventOf({
    id: "ev-95937289",
    amount_vnd: 2000,
    external_ref: "Test Sepay",
    body: "Test Sepay",
    event_id: "sepay:95937289",
})

const MATCH: Judgement = { verdict: "match", candidateId: "order-dinh", reasons: ["Tên, số tiền và lời báo của khách khớp"] }

const build = async (options: WorkPerformersOptions = { writer: "unused" }) => {
    const kit = mock<PerformerKitService>()
    kit.text.mockImplementation((_ctx, key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    kit.money.mockImplementation((_ctx, amount) => (amount === null || amount === undefined ? "none" : `${amount} VND`))
    const orders = mock<OrdersService>()
    orders.list.mockResolvedValue([dinhOrder()])
    orders.find.mockResolvedValue(orderOf({ id: "order-dinh", lead_id: "lead-dinh", order_no: "SO-0001", amount_vnd: 5000 }))
    orders.settle.mockResolvedValue(true)
    const claims = mock<OrderPaymentClaimsService>()
    claims.openOf.mockResolvedValue([dinhClaim()])
    claims.escalate.mockResolvedValue(true)
    const judge = mock<OrderPaymentJudgeService>()
    const transactions = mock<TransactionsService>()
    transactions.ofInboundEvent.mockResolvedValue(null)
    transactions.open.mockResolvedValue(transactionOf({ id: "tx-1", amount_vnd: 5000 }))
    const inbound = mock<InboundEventsService>()
    const engine = mock<WorkEngineService>()
    engine.runWork.mockResolvedValue(itemOf({ id: "item-1", lead_id: "lead-dinh", subject_id: "tx-1" }))
    const evidence = mock<EvidenceService>()
    const leads = mock<LeadRecordsService>()
    leads.find.mockResolvedValue(leadOf({ id: "lead-dinh", contact_name: "Bùi Nguyên Định", channel: "Zalo" }))
    const delivery = mock<CustomerDeliveryService>()
    const logger = mock<Logger>()
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            OrderPaymentReconcileService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: WORK_PERFORMERS_OPTIONS, useValue: options },
            { provide: PerformerKitService, useValue: kit },
            { provide: OrdersService, useValue: orders },
            { provide: OrderPaymentClaimsService, useValue: claims },
            { provide: OrderPaymentJudgeService, useValue: judge },
            { provide: TransactionsService, useValue: transactions },
            { provide: InboundEventsService, useValue: inbound },
            { provide: WorkEngineService, useValue: engine },
            { provide: EvidenceService, useValue: evidence },
            { provide: LeadRecordsService, useValue: leads },
            { provide: CustomerDeliveryService, useValue: delivery },
        ],
    }).compile()
    return {
        service: moduleRef.get(OrderPaymentReconcileService),
        orders,
        claims,
        judge,
        transactions,
        inbound,
        engine,
        evidence,
        leads,
        delivery,
        logger,
        tx,
    }
}

describe("OrderPaymentReconcileService plan", () => {
    it("matches the credit with no order code to Định's order when his claim came before the money", async () => {
        const { service, judge } = await build()
        judge.judge.mockResolvedValue(MATCH)

        const outcome = await service.plan(ctx, dinhCredit)

        expect(outcome).toMatchObject({ stage: "judge", effect: { kind: "apply", candidateId: "order-dinh" } })
        const brief = judge.judge.mock.calls[0]?.[1]
        expect(brief?.claims.map((claim) => claim.text)).toEqual(["Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH"])
        const evidence = brief?.candidates[0]?.evidence.filter((item) => item.met).map((item) => item.key)
        expect(evidence).toEqual(expect.arrayContaining(["amount", "name", "claim", "recency"]))
    })

    it("leaves the unrelated 2,000 MoMo credit unmatched without asking the model", async () => {
        const { service, judge } = await build()

        const outcome = await service.plan(ctx, momoCredit)

        expect(outcome).toMatchObject({ stage: "no_evidence", effect: { kind: "leave" } })
        expect(judge.judge).not.toHaveBeenCalled()
    })

    it("applies by itself a credit that names the order code with the amount due", async () => {
        const { service, judge } = await build()

        const outcome = await service.plan(ctx, eventOf({ amount_vnd: 5000, external_ref: "thanh toan SO-0001" }))

        expect(outcome).toMatchObject({ stage: "code", effect: { kind: "apply", candidateId: "order-dinh" } })
        expect(judge.judge).not.toHaveBeenCalled()
    })

    it("plans nothing for a credit with no amount or when no order waits for money inside the window", async () => {
        const { service, orders } = await build({ writer: "unused", orderWindowHours: 1 })
        await expect(service.plan(ctx, eventOf({ amount_vnd: null }))).resolves.toBeNull()
        orders.list.mockResolvedValue([dinhOrder({ confirmed_at: "2026-11-03T00:00:00.000Z" })])
        await expect(service.plan(ctx, dinhCredit)).resolves.toBeNull()
    })
})

describe("OrderPaymentReconcileService open", () => {
    it("opens a clear work item for a match, with the reasons on it, and does not mark anything paid", async () => {
        const { service, judge, engine, transactions, evidence, orders } = await build()
        judge.judge.mockResolvedValue(MATCH)
        const outcome = await service.plan(ctx, dinhCredit)
        if (outcome === null) throw new Error("no outcome")

        const item = await service.open(ctx, dinhCredit, outcome)

        expect(item).not.toBeNull()
        const spec = engine.runWork.mock.calls[0]?.[1]
        expect(spec).toMatchObject({
            action: "reconcile_payment",
            subject_type: "transaction",
            subject_id: "tx-1",
            lead_id: "lead-dinh",
            inbound_event_id: "ev-95958515",
            dedupeKey: "reconcile_payment:inbound:ev-95958515",
            preset: true,
        })
        expect(spec).not.toHaveProperty("forceAsk")
        expect(spec?.seed).toMatchObject({
            outcome: "clear",
            amount_vnd: 5000,
            candidates: [{ id: "order-dinh", amount_vnd: 5000 }],
            fields: { target: "order", stage: "judge", reasons: "Tên, số tiền và lời báo của khách khớp" },
        })
        expect(transactions.open).toHaveBeenCalledTimes(1)
        expect(evidence.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "payment.judged" }))
        expect(orders.settle).not.toHaveBeenCalled()
    })

    it("sends an ambiguous credit to the owner: unclear, always asked, never marked paid", async () => {
        const { service, judge, engine, orders } = await build()
        orders.list.mockResolvedValue([dinhOrder(), dinhOrder({ id: "order-2", order_no: "SO-0002", lead_id: "lead-2" })])
        judge.judge.mockResolvedValue({ verdict: "ambiguous", candidateId: null, reasons: ["Hai đơn cùng số tiền"] })
        const outcome = await service.plan(ctx, dinhCredit)
        if (outcome === null) throw new Error("no outcome")

        await service.open(ctx, dinhCredit, outcome)

        const spec = engine.runWork.mock.calls[0]?.[1]
        expect(spec).toMatchObject({ forceAsk: "unclear_outcome", lead_id: null })
        expect(spec?.seed).toMatchObject({ outcome: "unclear" })
        expect(spec?.seed?.candidates).toHaveLength(2)
        expect(orders.settle).not.toHaveBeenCalled()
    })

    it("asks the owner about an amount mismatch the judge would have matched", async () => {
        const { service, judge, engine } = await build()
        judge.judge.mockResolvedValue(MATCH)
        const short = eventOf({ ...dinhCredit, amount_vnd: 4000 })
        const outcome = await service.plan(ctx, short)
        if (outcome === null) throw new Error("no outcome")

        await service.open(ctx, short, outcome)

        expect(outcome.effect).toEqual({ kind: "ask", candidateIds: ["order-dinh"] })
        expect(engine.runWork.mock.calls[0]?.[1]).toMatchObject({ forceAsk: "unclear_outcome" })
    })

    it("opens nothing for a credit that is left, and reuses the transaction already recorded for the credit", async () => {
        const { service, judge, engine, transactions } = await build()
        const left = await service.plan(ctx, momoCredit)
        if (left === null) throw new Error("no outcome")
        await expect(service.open(ctx, momoCredit, left)).resolves.toBeNull()
        expect(engine.runWork).not.toHaveBeenCalled()

        judge.judge.mockResolvedValue(MATCH)
        transactions.ofInboundEvent.mockResolvedValue(transactionOf({ id: "tx-existing" }))
        const outcome = await service.plan(ctx, dinhCredit)
        if (outcome === null) throw new Error("no outcome")
        await service.open(ctx, dinhCredit, outcome)
        expect(transactions.open).not.toHaveBeenCalled()
        expect(engine.runWork.mock.calls[0]?.[1]).toMatchObject({ subject_id: "tx-existing" })
    })

    it("words the rules' own reasons and keeps the judge's sentence as it is", async () => {
        const { service, engine } = await build()
        const outcome = await service.plan(ctx, eventOf({ amount_vnd: 5000, external_ref: "SO-0001" }))
        if (outcome === null) throw new Error("no outcome")
        await service.open(ctx, dinhCredit, outcome)
        expect(engine.runWork.mock.calls[0]?.[1]?.seed?.fields).toMatchObject({
            reasons: "orderPaymentReason.code_and_amount",
        })
    })
})

describe("OrderPaymentReconcileService settle", () => {
    const item: WorkItem = itemOf({ subject_type: "transaction", subject_id: "tx-1", inbound_event_id: "ev-95958515" })
    const proposal = proposalOf({
        amount_vnd: 5000,
        candidates: [{ id: "order-dinh", label: "SO-0001", amount_vnd: 5000 }],
        fields: { target: "order", reasons: "khớp" },
    })
    const by = { name: "NIVO" } as never

    it("marks the order paid, links the transaction, settles his claim and confirms on his channel", async () => {
        const { service, orders, transactions, claims, delivery, tx } = await build()

        const performed = await service.settle(ctx, item, proposal, by)

        expect(orders.settle).toHaveBeenCalledWith("ws-1", "order-dinh", expect.anything())
        expect(transactions.matchOrder).toHaveBeenCalledWith("ws-1", "tx-1", "order-dinh", expect.anything())
        expect(claims.settle).toHaveBeenCalledWith("ws-1", ["claim-1"], "tx-1", expect.anything())
        expect(delivery.toCustomer).toHaveBeenCalledWith(
            ctx,
            { id: "lead-dinh", contact_name: "Bùi Nguyên Định", channel: "Zalo" },
            "orderPaymentConfirmed|SO-0001|5000 VND",
        )
        expect(performed).toMatchObject({ evidence: "verified", lead_id: "lead-dinh" })
        expect(tx.commits).toBe(1)
    })

    it("pays one order once: a second settlement of an order that no longer waits changes nothing", async () => {
        const { service, orders, transactions, delivery, tx } = await build()
        orders.settle.mockResolvedValue(false)

        await expect(service.settle(ctx, item, proposal, by)).rejects.toMatchObject({
            code: "WORK_PERFORMERS_ORDER_UNAVAILABLE",
        })

        expect(transactions.matchOrder).not.toHaveBeenCalled()
        expect(delivery.toCustomer).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })

    it("needs exactly one chosen order and an order that exists", async () => {
        const { service, orders } = await build()
        await expect(service.settle(ctx, item, proposalOf({ candidates: [] }), by)).rejects.toMatchObject({
            code: DecisionsErrorCode.ChooseCandidate,
        })
        orders.find.mockResolvedValue(null)
        await expect(service.settle(ctx, item, proposal, by)).rejects.toMatchObject({
            code: "WORK_PERFORMERS_ORDER_UNAVAILABLE",
        })
    })

    it("settles an order a person confirmed from the bank, with no transaction to link", async () => {
        const { service, transactions, claims, delivery } = await build()
        delivery.toCustomer.mockRejectedValue(new Error("zalo down"))

        await service.settle(ctx, itemOf({ subject_type: "lead", subject_id: "lead-dinh" }), proposal, by)

        expect(transactions.matchOrder).not.toHaveBeenCalled()
        expect(claims.settle).toHaveBeenCalledWith("ws-1", ["claim-1"], null, expect.anything())
    })

    it("keeps the order paid when the confirmation cannot be sent, and tells no one without a known customer", async () => {
        const { service, logger, leads, orders } = await build()
        const failing = await build()
        failing.delivery.toCustomer.mockRejectedValue(new Error("zalo down"))
        await failing.service.settle(ctx, item, proposal, by)
        expect(failing.logger.error).toHaveBeenCalled()

        orders.find.mockResolvedValue(orderOf({ id: "order-dinh", lead_id: null }))
        await service.settle(ctx, item, proposal, by)
        expect(leads.find).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()

        orders.find.mockResolvedValue(orderOf({ id: "order-dinh", lead_id: "lead-gone" }))
        leads.find.mockResolvedValue(null)
        await service.settle(ctx, item, proposal, by)
    })
})

describe("OrderPaymentReconcileService raiseOverdue", () => {
    it("hands a claim whose money never came to the owner once, after the configured wait", async () => {
        const { service, claims, engine, evidence } = await build({ writer: "unused", claimTimeoutMinutes: 10 })
        claims.overdue.mockResolvedValue([dinhClaim()])

        await expect(service.raiseOverdue()).resolves.toBe(1)

        expect(claims.overdue).toHaveBeenCalledWith(new Date("2026-11-04T00:56:00.000Z"), 50)
        expect(claims.escalate).toHaveBeenCalledWith("ws-1", "claim-1")
        const spec = engine.runWork.mock.calls[0]?.[1]
        expect(spec).toMatchObject({
            action: "reconcile_payment",
            dedupeKey: "reconcile_payment:claim:claim-1",
            forceAsk: "unclear_outcome",
            lead_id: "lead-dinh",
        })
        expect(spec?.seed).toMatchObject({
            outcome: "unclear",
            candidates: [{ id: "order-dinh" }],
            fields: { target: "order", reasons: "orderPaymentOverdue|Bùi Nguyên Định|10" },
        })
        expect(evidence.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "payment.claim_overdue" }))
    })

    it("raises a claim that another tick already escalated no second time, and waits half an hour by default", async () => {
        const { service, claims, engine, orders, leads } = await build()
        claims.overdue.mockResolvedValue([dinhClaim()])
        claims.escalate.mockResolvedValue(false)
        await expect(service.raiseOverdue()).resolves.toBe(0)
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(claims.overdue).toHaveBeenCalledWith(new Date("2026-11-04T00:36:00.000Z"), 50)

        claims.escalate.mockResolvedValue(true)
        orders.list.mockResolvedValue([])
        leads.find.mockResolvedValueOnce(null)
        await service.raiseOverdue()
        expect(engine.runWork.mock.calls[0]?.[1]?.seed?.fields).toMatchObject({ payer: "—" })
    })
})
