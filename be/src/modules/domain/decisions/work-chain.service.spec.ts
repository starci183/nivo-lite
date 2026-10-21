import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CommandPlannerService } from "./command-planner.service"
import type { ActionEntry, SendCommandInput, WorkContext, WorkItem, WorkSpec } from "./decisions.contracts"
import { ModuleCatalogService } from "./module-catalog.service"
import { FIND_LEAD_STAGE, FOLLOW_UP_IS_PENDING } from "./persistence/chain-reads.sql"
import type { CommandPlan } from "./work-engine.contracts"
import { LEAD_GEN_FLOW, PAYMENT_RECEIPTS } from "./work-engine.decorators"
import type { LeadGenFlow, PaymentReceipts } from "./work-engine.port"
import { WorkChainService } from "./work-chain.service"
import { WorkIntakeService } from "./work-intake.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "classify_lead",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: "in-1",
    parent_id: null,
    chain_id: "chain-1",
    depth: 0,
    status: "done",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "S", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const actionOf = (action: string, moduleKey: string, next: ReadonlyArray<string> = []): ActionEntry => ({
    action,
    moduleKey,
    maxMode: null,
    next,
    label: { vi: action, en: action },
})

const ACTIONS: Readonly<Record<string, ActionEntry>> = {
    classify_lead: actionOf("classify_lead", "sales", ["send_follow_up"]),
    send_follow_up: actionOf("send_follow_up", "sales"),
    handoff_lead: actionOf("handoff_lead", "chatbot", ["classify_lead"]),
    confirm_order: actionOf("confirm_order", "sales", ["issue_invoice"]),
    issue_invoice: actionOf("issue_invoice", "accounting"),
    reconcile_payment: actionOf("reconcile_payment", "accounting", ["send_care", "other_step", "unknown_step"]),
    send_care: actionOf("send_care", "sales"),
    other_step: actionOf("other_step", "sales"),
    greet_prospect: actionOf("greet_prospect", "lead_gen", ["send_follow_up"]),
    handoff_to_sales: actionOf("handoff_to_sales", "lead_gen", ["classify_lead"]),
}

interface Built {
    readonly service: WorkChainService
    readonly receipts: jest.Mock
    readonly leadGen: jest.Mock
    readonly sent: Array<SendCommandInput>
    readonly inserted: Array<WorkSpec>
}

const build = async (entityManager: MockEntityManager, refuse = false): Promise<Built> => {
    const sent: Array<SendCommandInput> = []
    const inserted: Array<WorkSpec> = []
    const receipts = jest.fn().mockResolvedValue(undefined)
    const leadGen = jest.fn().mockResolvedValue(undefined)
    const plan = jest.fn((_ctx: WorkContext, input: SendCommandInput): Promise<CommandPlan> => {
        sent.push(input)
        if (refuse) return Promise.resolve({ ok: false, refused: "cycle", detail: "again" })
        const spec: WorkSpec = {
            action: input.command,
            subject_type: "lead",
            dedupeKey: input.dedupeKey ?? "none",
        }
        return Promise.resolve({ ok: true, spec, depth: 1, inserted: () => true })
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkChainService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: PAYMENT_RECEIPTS, useValue: mock<PaymentReceipts>({ receiptFor: receipts }) },
            { provide: LEAD_GEN_FLOW, useValue: mock<LeadGenFlow>({ continueAfter: leadGen }) },
            {
                provide: ModuleCatalogService,
                useValue: mock<ModuleCatalogService>({
                    actionOf: jest.fn((action: string) => Promise.resolve(ACTIONS[action] ?? null)),
                }),
            },
            { provide: CommandPlannerService, useValue: mock<CommandPlannerService>({ plan }) },
            {
                provide: WorkIntakeService,
                useValue: mock<WorkIntakeService>({
                    insert: jest.fn((_ctx: WorkContext, spec: WorkSpec) => {
                        inserted.push(spec)
                        return Promise.resolve({ item: itemOf(), created: true })
                    }),
                }),
            },
        ],
    }).compile()
    return { service: moduleRef.get(WorkChainService), receipts, leadGen, sent, inserted }
}

describe("WorkChainService", () => {
    it("queues the classification after a hand-off", async () => {
        const built = await build(mockEntityManager())

        await built.service.continueChain(ctx, itemOf({ action: "handoff_lead", department: "chatbot" }))

        expect(built.sent).toEqual([
            {
                from: "chatbot",
                to: "sales",
                command: "classify_lead",
                parentId: "item-1",
                chainId: "chain-1",
                inboundEventId: "in-1",
                queue: true,
                reason: "handoff",
                dedupeKey: "classify_lead:after:item-1",
                payload: { subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1" },
            },
        ])
        expect(built.inserted.map((spec) => [spec.action, spec.queue])).toEqual([["classify_lead", true]])
    })

    it("starts the chain at the item itself when it has no chain yet", async () => {
        const built = await build(mockEntityManager())

        await built.service.continueChain(ctx, itemOf({ action: "handoff_lead", chain_id: null }))

        expect(built.sent.map((input) => input.chainId)).toEqual(["item-1"])
    })

    it("skips a step that needs a customer when the item has none", async () => {
        const built = await build(mockEntityManager())

        await built.service.continueChain(ctx, itemOf({ action: "handoff_lead", lead_id: null }))
        await built.service.continueChain(ctx, itemOf({ action: "classify_lead", lead_id: null }))

        expect(built.sent).toEqual([])
    })

    it("queues a follow-up for a customer who is neither lost, won nor waiting", async () => {
        const built = await build(
            mockEntityManager({
                query: [
                    [FIND_LEAD_STAGE, [{ stage: "new" }]],
                    [FOLLOW_UP_IS_PENDING, [{ pending: false }]],
                ],
            }),
        )

        await built.service.continueChain(ctx, itemOf())

        expect(built.sent.map((input) => [input.command, input.reason, input.dedupeKey])).toEqual([
            ["send_follow_up", "classified", "send_follow_up:after:item-1"],
        ])
    })

    it("queues a follow-up when the customer cannot be read and nothing is probed", async () => {
        const built = await build(
            mockEntityManager({
                query: [
                    [FIND_LEAD_STAGE, []],
                    [FOLLOW_UP_IS_PENDING, []],
                ],
            }),
        )

        await built.service.continueChain(ctx, itemOf())

        expect(built.sent).toHaveLength(1)
    })
})

describe("WorkChainService", () => {
    it("queues no follow-up for a lost lead", async () => {
        const built = await build(mockEntityManager())

        await built.service.continueChain(ctx, itemOf({ proposal: { summary: "S", fields: { stage: "lost" } } }))

        expect(built.sent).toEqual([])
    })

    it("queues no follow-up for a customer who already bought", async () => {
        const built = await build(mockEntityManager({ query: [FIND_LEAD_STAGE, [{ stage: "won" }]] }))

        await built.service.continueChain(ctx, itemOf())

        expect(built.sent).toEqual([])
    })

    it("queues no second follow-up while one waits for a decision", async () => {
        const built = await build(
            mockEntityManager({
                query: [
                    [FIND_LEAD_STAGE, [{ stage: "new" }]],
                    [FOLLOW_UP_IS_PENDING, [{ pending: true }]],
                ],
            }),
        )

        await built.service.continueChain(ctx, itemOf())

        expect(built.sent).toEqual([])
    })

    it("queues the invoice of a confirmed order, once per order", async () => {
        const built = await build(mockEntityManager())

        await built.service.continueChain(
            ctx,
            itemOf({ action: "confirm_order", subject_type: "order", subject_id: "order-1" }),
        )

        expect(built.sent.map((input) => [input.to, input.command, input.dedupeKey, input.payload])).toEqual([
            [
                "accounting",
                "issue_invoice",
                "issue_invoice:order:order-1",
                { subject_type: "order", subject_id: "order-1", lead_id: "lead-1" },
            ],
        ])
    })

    it("queues no invoice for an item that is not about an order", async () => {
        const built = await build(mockEntityManager())

        await built.service.continueChain(ctx, itemOf({ action: "confirm_order", subject_type: "inbound" }))
        await built.service.continueChain(
            ctx,
            itemOf({ action: "confirm_order", subject_type: "order", subject_id: null }),
        )

        expect(built.sent).toEqual([])
    })
})

describe("WorkChainService", () => {
    describe("after a reconciled payment", () => {
        const paid = (overrides: Partial<WorkItem>): WorkItem =>
            itemOf({ action: "reconcile_payment", department: "accounting", subject_type: "transaction", ...overrides })

        it("tells the receipt pipeline about the transaction and the one settled invoice", async () => {
            const built = await build(mockEntityManager())
            const candidates = [{ id: "inv-1", label: "One", amount_vnd: 1 }]

            await built.service.continueChain(
                ctx,
                paid({ subject_id: "tx-1", proposal: { summary: "S", fields: {}, candidates } }),
            )

            expect(built.receipts).toHaveBeenCalledWith(ctx, { transactionId: "tx-1", invoiceId: "inv-1" })
            expect(built.sent.map((input) => [input.command, input.dedupeKey, input.payload])).toEqual([
                [
                    "send_care",
                    "send_care:invoice:inv-1",
                    { subject_type: "transaction", subject_id: "tx-1", lead_id: "lead-1", invoice_id: "inv-1" },
                ],
            ])
        })

        it("falls back to the transaction when several invoices are candidates", async () => {
            const built = await build(mockEntityManager())
            const candidates = [
                { id: "inv-1", label: "One", amount_vnd: 1 },
                { id: "inv-2", label: "Two", amount_vnd: 2 },
            ]

            await built.service.continueChain(
                ctx,
                paid({ subject_id: "tx-1", proposal: { summary: "S", fields: {}, candidates } }),
            )

            expect(built.receipts).toHaveBeenCalledWith(ctx, { transactionId: "tx-1", invoiceId: null })
            expect(built.sent.map((input) => input.dedupeKey)).toEqual(["send_care:transaction:tx-1"])
        })

        it("takes the invoice from an invoice subject", async () => {
            const built = await build(mockEntityManager())

            await built.service.continueChain(ctx, paid({ subject_type: "invoice", subject_id: "inv-9" }))

            expect(built.receipts).toHaveBeenCalledWith(ctx, { transactionId: null, invoiceId: "inv-9" })
            expect(built.sent.map((input) => input.payload)).toEqual([
                { subject_type: "invoice", subject_id: "inv-9", lead_id: "lead-1" },
            ])
        })

        it("sends no care message without a subject or a customer", async () => {
            const built = await build(mockEntityManager())

            await built.service.continueChain(ctx, paid({ subject_id: null }))
            await built.service.continueChain(ctx, paid({ subject_id: "tx-1", lead_id: null }))
            await built.service.continueChain(ctx, paid({ subject_type: "lead", subject_id: "lead-1" }))

            expect(built.sent).toEqual([])
            expect(built.receipts).toHaveBeenCalledTimes(3)
        })
    })
})

describe("WorkChainService", () => {
    describe("lead generation", () => {
        it("hands a lead generation step to the lead flow", async () => {
            const built = await build(mockEntityManager())
            const item = itemOf({ action: "greet_prospect", department: "lead_gen" })

            await built.service.continueChain(ctx, item)

            expect(built.leadGen).toHaveBeenCalledWith(ctx, item)
            expect(built.sent).toEqual([])
        })

        it("lets the hand-off to sales use the generic loop", async () => {
            const built = await build(mockEntityManager())

            await built.service.continueChain(ctx, itemOf({ action: "handoff_to_sales", department: "lead_gen" }))

            expect(built.leadGen).not.toHaveBeenCalled()
            expect(built.sent.map((input) => input.command)).toEqual(["classify_lead"])
        })
    })

    it("queues nothing for an action with no next step or an unknown one", async () => {
        const built = await build(mockEntityManager())

        await built.service.continueChain(ctx, itemOf({ action: "send_follow_up" }))
        await built.service.continueChain(ctx, itemOf({ action: "mystery" }))

        expect(built.sent).toEqual([])
    })

    it("never inserts a command the planner refused", async () => {
        const built = await build(mockEntityManager(), true)

        await built.service.continueChain(ctx, itemOf({ action: "handoff_lead" }))

        expect(built.sent).toHaveLength(1)
        expect(built.inserted).toEqual([])
    })
})
