import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EvidenceService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InvoicesService } from "@modules/domain/invoices"
import { OrdersService } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import type { OptionalTransaction } from "@modules/domain/transactions"
import { WorkItemsService } from "@modules/domain/work-items"
import { PerformerKitService } from "./performer-kit.service"
import { ReconcilePaymentPerformerService } from "./reconcile-payment-performer.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

const transaction: NonNullable<OptionalTransaction> = {
    id: "tx-1",
    workspace_id: "ws-1",
    inbound_event_id: null,
    amount_vnd: 1000,
    reference: "REF",
    payer: "Lan",
    invoice_id: null,
    status: "unmatched",
    origin: "live",
}

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "reconcile_payment",
    subject_type: "transaction",
    subject_id: "tx-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Pay", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

describe("ReconcilePaymentPerformerService", () => {
    const build = async () => {
        const kit = mock<PerformerKitService>()
        kit.text.mockReturnValue("1.000 from Lan")
        kit.money.mockReturnValue("1.000")
        const transactions = mock<TransactionsService>()
        transactions.find.mockResolvedValue(transaction)
        const invoices = mock<InvoicesService>()
        invoices.listIssued.mockResolvedValue([])
        const moduleRef = await Test.createTestingModule({
            providers: [
                ReconcilePaymentPerformerService,
                { provide: PerformerKitService, useValue: kit },
                { provide: TransactionsService, useValue: transactions },
                { provide: InvoicesService, useValue: invoices },
                { provide: OrdersService, useValue: mock<OrdersService>() },
                { provide: InboundEventsService, useValue: mock<InboundEventsService>() },
                { provide: WorkItemsService, useValue: mock<WorkItemsService>() },
                { provide: EvidenceService, useValue: mock<EvidenceService>() },
            ],
        }).compile()
        return moduleRef.get(ReconcilePaymentPerformerService)
    }

    it("offers no invoice when none is issued", async () => {
        const service = await build()

        await expect(service.prepare(ctx, itemOf())).resolves.toEqual({
            proposal: {
                summary: "1.000 from Lan",
                amount_vnd: 1000,
                outcome: "unclear",
                candidates: [],
                fields: { amount_vnd: 1000, reference: "REF", payer: "Lan" },
            },
        })
    })
})
