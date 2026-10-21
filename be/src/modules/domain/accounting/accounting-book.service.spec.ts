import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AccountingAdjustmentsService } from "@modules/domain/accounting-adjustments"
import type { AccountingAdjustmentRow } from "@modules/domain/accounting-adjustments"
import { EvidenceService } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import { OrdersService } from "@modules/domain/orders"
import type { SalesOrderListRow } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkItemsService } from "@modules/domain/work-items"
import { AccountingBookService } from "./accounting-book.service"

const WORKSPACE = "ws-1"

const orderOf = builder<SalesOrderListRow>({
    id: "o-1",
    workspace_id: WORKSPACE,
    lead_id: "lead-1",
    inbound_event_id: null,
    order_no: "SO-1",
    items: "2 cakes",
    amount_vnd: 200000,
    status: "confirmed",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-10-12T10:00:00Z",
    shipped_at: null,
    carrier: null,
    tracking_code: null,
    contact_name: "Mai",
    company: "Mai Bakery",
})

const ADJUSTMENT: AccountingAdjustmentRow = {
    id: "adj-1",
    target_type: "invoice",
    target_id: "inv-1",
    note: "Customer paid less",
    corrected_amount_vnd: 90000,
    created_by: "Lan",
    created_at: "2026-10-12T10:00:00Z",
}

const build = async (orders: ReadonlyArray<SalesOrderListRow>, ready = true) => {
    const invoices = mock<InvoicesService>({ listAccounting: jest.fn(() => Promise.resolve([])) })
    const transactions = mock<TransactionsService>({ listAccounting: jest.fn(() => Promise.resolve([])) })
    const orderService = mock<OrdersService>({ list: jest.fn(() => Promise.resolve([...orders])) })
    const workItems = mock<WorkItemsService>({ listAccounting: jest.fn(() => Promise.resolve([])) })
    const evidence = mock<EvidenceService>({ listAccounting: jest.fn(() => Promise.resolve([])) })
    const adjustments = mock<AccountingAdjustmentsService>({
        history: jest.fn(() => Promise.resolve({ items: ready ? [ADJUSTMENT] : [], ready })),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountingBookService,
            { provide: InvoicesService, useValue: invoices },
            { provide: TransactionsService, useValue: transactions },
            { provide: OrdersService, useValue: orderService },
            { provide: WorkItemsService, useValue: workItems },
            { provide: EvidenceService, useValue: evidence },
            { provide: AccountingAdjustmentsService, useValue: adjustments },
        ],
    }).compile()
    return { service: moduleRef.get(AccountingBookService), orderService }
}

describe("AccountingBookService", () => {
    it("composes the book with the customer labels of each order and the corrections", async () => {
        const { service, orderService } = await build([orderOf(), orderOf({ id: "o-2", lead_id: null })])

        const book = await service.read(WORKSPACE)

        expect(book.orders.map((order) => order.lead)).toEqual([{ contact_name: "Mai", company: "Mai Bakery" }, null])
        expect(book.adjustments).toEqual([ADJUSTMENT])
        expect(book.adjustmentsReady).toBe(true)
        expect(book.invoices).toEqual([])
        expect(orderService.list).toHaveBeenCalledWith(WORKSPACE, 500)
    })

    it("keeps at most 500 orders and says when corrections are not available", async () => {
        const many = Array.from({ length: 501 }, (_, index) => orderOf({ id: `o-${index}` }))
        const { service } = await build(many, false)

        const book = await service.read(WORKSPACE)

        expect(book.orders).toHaveLength(500)
        expect(book.adjustments).toEqual([])
        expect(book.adjustmentsReady).toBe(false)
    })
})
