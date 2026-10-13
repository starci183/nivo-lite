import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AccountingAdjustmentsService } from "@modules/domain/accounting-adjustments"
import { EvidenceService } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import { OrdersService } from "@modules/domain/orders"
import type { SalesOrderListRow } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkItemsService } from "@modules/domain/work-items"
import { AccountingBookService } from "./accounting-book.service"

const listedOrder = (id: string, leadId: string | null): SalesOrderListRow => ({
    id,
    workspace_id: "ws-1",
    lead_id: leadId,
    inbound_event_id: null,
    order_no: "SO-1",
    items: "Tea",
    amount_vnd: 1_000,
    status: "confirmed",
    origin: "live",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
    contact_name: leadId === null ? null : "Minh",
    company: leadId === null ? null : "Starci",
})

const build = async () => {
    const invoices = mock<InvoicesService>()
    const transactions = mock<TransactionsService>()
    const orders = mock<OrdersService>()
    const workItems = mock<WorkItemsService>()
    const evidence = mock<EvidenceService>()
    const adjustments = mock<AccountingAdjustmentsService>()
    invoices.listAccounting.mockResolvedValue([])
    transactions.listAccounting.mockResolvedValue([])
    orders.list.mockResolvedValue([])
    workItems.listAccounting.mockResolvedValue([])
    evidence.listAccounting.mockResolvedValue([])
    adjustments.history.mockResolvedValue({ items: [], ready: true })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountingBookService,
            { provide: InvoicesService, useValue: invoices },
            { provide: TransactionsService, useValue: transactions },
            { provide: OrdersService, useValue: orders },
            { provide: WorkItemsService, useValue: workItems },
            { provide: EvidenceService, useValue: evidence },
            { provide: AccountingAdjustmentsService, useValue: adjustments },
        ],
    }).compile()
    return {
        service: moduleRef.get(AccountingBookService),
        invoices,
        transactions,
        orders,
        workItems,
        evidence,
        adjustments,
    }
}

describe("AccountingBookService", () => {
    it("assembles the book, attaching a customer only when the order names one", async () => {
        const { service, invoices, transactions, orders, workItems, evidence, adjustments } = await build()
        const withLead = listedOrder("order-1", "lead-1")
        const withoutLead = listedOrder("order-2", null)
        orders.list.mockResolvedValue([withLead, withoutLead])
        adjustments.history.mockResolvedValue({ items: [], ready: false })

        await expect(service.read("ws-1")).resolves.toEqual({
            invoices: [],
            transactions: [],
            orders: [
                { ...withLead, lead: { contact_name: "Minh", company: "Starci" } },
                { ...withoutLead, lead: null },
            ],
            works: [],
            decisions: [],
            adjustments: [],
            adjustmentsReady: false,
        })

        expect(invoices.listAccounting).toHaveBeenCalledWith("ws-1")
        expect(transactions.listAccounting).toHaveBeenCalledWith("ws-1")
        expect(orders.list).toHaveBeenCalledWith("ws-1", 500)
        expect(workItems.listAccounting).toHaveBeenCalledWith("ws-1")
        expect(evidence.listAccounting).toHaveBeenCalledWith("ws-1")
        expect(adjustments.history).toHaveBeenCalledWith("ws-1")
    })

    it("keeps the first 500 orders", async () => {
        const { service, orders } = await build()
        const rows = Array.from({ length: 501 }, (_, index) => listedOrder(`order-${index}`, "lead-1"))
        orders.list.mockResolvedValue(rows)

        const book = await service.read("ws-1")

        expect(book.orders.map((order) => order.id)).toEqual(
            Array.from({ length: 500 }, (_, index) => `order-${index}`),
        )
        expect(book.orders.map((order) => order.lead)).toEqual(
            Array.from({ length: 500 }, () => ({ contact_name: "Minh", company: "Starci" })),
        )
    })
})
