import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CommandPlannerService } from "./command-planner.service"
import type { ActionEntry, SendCommandInput, WorkContext, WorkItem, WorkSpec } from "./decisions.contracts"
import { ModuleCatalogService } from "./module-catalog.service"
import type { CommandPlan } from "./work-engine.contracts"
import { WorkChainService } from "./work-chain.service"
import { WorkIntakeService } from "./work-intake.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "confirm_order",
    subject_type: "order",
    subject_id: "order-1",
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
    confirm_order: actionOf("confirm_order", "sales", ["issue_invoice"]),
    issue_invoice: actionOf("issue_invoice", "accounting"),
    reconcile_payment: actionOf("reconcile_payment", "accounting", ["send_care", "other_step", "unknown_step"]),
    send_care: actionOf("send_care", "sales"),
    other_step: actionOf("other_step", "sales"),
}

interface Built {
    readonly service: WorkChainService
    readonly sent: Array<SendCommandInput>
    readonly inserted: Array<WorkSpec>
}

const build = async (refuse = false): Promise<Built> => {
    const sent: Array<SendCommandInput> = []
    const inserted: Array<WorkSpec> = []
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
    return {
        service: moduleRef.get(WorkChainService),
        sent,
        inserted,
    }
}

describe("WorkChainService", () => {
    it("starts the chain at the item itself when it has no chain yet", async () => {
        const built = await build()

        await built.service.continueChain(ctx, itemOf({ chain_id: null }))

        expect(built.sent.map((input) => input.chainId)).toEqual(["item-1"])
    })

    it("keeps the chain of the item when it has one", async () => {
        const built = await build()

        await built.service.continueChain(ctx, itemOf())

        expect(built.sent).toEqual([
            expect.objectContaining({
                from: "sales",
                to: "accounting",
                parentId: "item-1",
                chainId: "chain-1",
                inboundEventId: "in-1",
                queue: true,
            }),
        ])
        expect(built.inserted.map((spec) => [spec.action, spec.queue])).toEqual([["issue_invoice", true]])
    })

    it("queues the invoice of a confirmed order, once per order", async () => {
        const built = await build()

        await built.service.continueChain(ctx, itemOf())

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
        const built = await build()

        await built.service.continueChain(ctx, itemOf({ subject_type: "inbound" }))
        await built.service.continueChain(ctx, itemOf({ subject_id: null }))

        expect(built.sent).toEqual([])
    })
})

describe("WorkChainService", () => {
    describe("after a reconciled payment", () => {
        const paid = (overrides: Partial<WorkItem>): WorkItem =>
            itemOf({ action: "reconcile_payment", department: "accounting", subject_type: "transaction", ...overrides })

        it("tells the receipt pipeline about the transaction and the one settled invoice", async () => {
            const built = await build()
            const candidates = [{ id: "inv-1", label: "One", amount_vnd: 1 }]

            await built.service.continueChain(
                ctx,
                paid({ subject_id: "tx-1", proposal: { summary: "S", fields: {}, candidates } }),
            )

            expect(built.sent.map((input) => [input.command, input.dedupeKey, input.payload])).toEqual([
                [
                    "send_care",
                    "send_care:invoice:inv-1",
                    { subject_type: "transaction", subject_id: "tx-1", lead_id: "lead-1", invoice_id: "inv-1" },
                ],
            ])
        })

        it("falls back to the transaction when several invoices are candidates", async () => {
            const built = await build()
            const candidates = [
                { id: "inv-1", label: "One", amount_vnd: 1 },
                { id: "inv-2", label: "Two", amount_vnd: 2 },
            ]

            await built.service.continueChain(
                ctx,
                paid({ subject_id: "tx-1", proposal: { summary: "S", fields: {}, candidates } }),
            )

            expect(built.sent.map((input) => input.dedupeKey)).toEqual(["send_care:transaction:tx-1"])
        })

        it("takes the invoice from an invoice subject", async () => {
            const built = await build()

            await built.service.continueChain(ctx, paid({ subject_type: "invoice", subject_id: "inv-9" }))

            expect(built.sent.map((input) => input.payload)).toEqual([
                { subject_type: "invoice", subject_id: "inv-9", lead_id: "lead-1" },
            ])
        })

        it("sends no care message without a subject or a customer", async () => {
            const built = await build()

            await built.service.continueChain(ctx, paid({ subject_id: null }))
            await built.service.continueChain(ctx, paid({ subject_id: "tx-1", lead_id: null }))
            await built.service.continueChain(ctx, paid({ subject_type: "lead", subject_id: "lead-1" }))

            expect(built.sent).toEqual([])
        })
    })
})

describe("WorkChainService", () => {
    it("queues nothing for an action with no next step or an unknown one", async () => {
        const built = await build()

        await built.service.continueChain(ctx, itemOf({ action: "issue_invoice" }))
        await built.service.continueChain(ctx, itemOf({ action: "mystery" }))

        expect(built.sent).toEqual([])
    })

    it("never inserts a command the planner refused", async () => {
        const built = await build(true)

        await built.service.continueChain(ctx, itemOf())

        expect(built.sent).toHaveLength(1)
        expect(built.inserted).toEqual([])
    })
})
