import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { DecisionsService } from "@modules/domain/decisions"
import type { InvoiceAccountingRow } from "@modules/domain/invoices"
import type { AccountingLedgerEntry } from "@modules/domain/ledger"
import { StaffService } from "@modules/domain/staff"
import type { StaffRow } from "@modules/domain/staff"
import { CLOCK } from "@modules/platform/clock"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { AccountingBookService } from "./accounting-book.service"
import type { AccountingBook, BookOrder } from "./accounting-book.contracts"
import type { AccountingWorkbenchView } from "./accounting-workbench-view.contracts"
import { AccountingService } from "./accounting.service"

const NOW = new Date("2026-10-12T00:00:00.000Z")

const ZERO = { live: 0, simulated: 0 }
const MEASURE = { vnd: ZERO, count: ZERO }
const RECEIVABLE = { vnd: { live: 250_000, simulated: 0 }, count: { live: 1, simulated: 0 } }

const weeks = (starts: ReadonlyArray<string>) => starts.map((startIso) => ({ startIso, live: 0, simulated: 0 }))

const INVOICE: InvoiceAccountingRow = {
    id: "inv-1",
    workspace_id: "ws-1",
    order_id: null,
    lead_id: null,
    invoice_no: "INV-1",
    amount_vnd: 250_000,
    status: "issued",
    origin: "live",
    issued_by: "user-1",
    paid_at: null,
    issued_at: "2026-10-02T00:00:00.000Z",
    due_at: "2026-10-20T00:00:00.000Z",
    created_at: "2026-10-01T00:00:00.000Z",
    order: null,
    lead: null,
}

const WITH_LEAD: BookOrder = {
    id: "order-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
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
    contact_name: "Minh",
    company: "Starci",
    lead: { contact_name: "Minh", company: "Starci" },
}

const WITHOUT_LEAD: BookOrder = {
    ...WITH_LEAD,
    id: "order-2",
    lead_id: null,
    order_no: "SO-2",
    contact_name: null,
    company: null,
    lead: null,
}

const STAFF: StaffRow = {
    id: "staff-1",
    workspace_id: "ws-1",
    name: "Minh",
    role: "accountant",
    email: "minh@example.com",
    active: true,
    created_at: "2026-10-01T00:00:00.000Z",
}

const LEDGER: AccountingLedgerEntry = {
    id: "inv:inv-1",
    targetType: "invoice",
    targetId: "inv-1",
    at: "2026-10-02T00:00:00.000Z",
    description: "INV-1",
    kind: "receivable",
    amount: 250_000,
    status: "issued",
    linked: null,
    origin: "live",
    lineage: [
        {
            kind: "invoice",
            title: "INV-1",
            detail: null,
            at: "2026-10-02T00:00:00.000Z",
            status: "issued",
            amount: 250_000,
        },
    ],
    adjustmentCount: 0,
}

const memberOf = (role: WorkspaceRole): WorkspaceMember => ({
    userId: "user-1",
    workspaceId: "ws-1",
    role,
    staffId: null,
    displayName: "Lan",
    status: "active",
})

const workbenchOf = (role: WorkspaceRole): AccountingWorkbenchView => ({
    now: "2026-10-12T00:00:00.000Z",
    periods: {
        this: {
            key: "this",
            fromIso: "2026-09-30T17:00:00.000Z",
            toIso: "2026-10-31T17:00:00.000Z",
            income: MEASURE,
            receivable: RECEIVABLE,
            unmatched: MEASURE,
            weeks: weeks([
                "2026-09-27T17:00:00.000Z",
                "2026-10-04T17:00:00.000Z",
                "2026-10-11T17:00:00.000Z",
                "2026-10-18T17:00:00.000Z",
                "2026-10-25T17:00:00.000Z",
            ]),
        },
        last: {
            key: "last",
            fromIso: "2026-08-31T17:00:00.000Z",
            toIso: "2026-09-30T17:00:00.000Z",
            income: MEASURE,
            receivable: MEASURE,
            unmatched: MEASURE,
            weeks: weeks([
                "2026-08-30T17:00:00.000Z",
                "2026-09-06T17:00:00.000Z",
                "2026-09-13T17:00:00.000Z",
                "2026-09-20T17:00:00.000Z",
                "2026-09-27T17:00:00.000Z",
            ]),
        },
    },
    ageing: { d0: RECEIVABLE, d30: MEASURE, d60: MEASURE },
    waiting: { count: ZERO, knownVnd: 0, unknownAmount: 0 },
    credits: [],
    invoices: [
        {
            id: "inv-1",
            invoiceNo: "INV-1",
            amount: 250_000,
            status: "issued",
            origin: "live",
            customer: null,
            issuedAt: "2026-10-02T00:00:00.000Z",
            paidAt: null,
            dueAt: "2026-10-20T00:00:00.000Z",
            createdAt: "2026-10-01T00:00:00.000Z",
            orderNo: null,
        },
    ],
    ordersWithoutInvoice: [],
    questions: [],
    staff: [
        {
            id: "staff-1",
            workspaceId: "ws-1",
            name: "Minh",
            role: "accountant",
            email: "minh@example.com",
            active: true,
            createdAt: "2026-10-01T00:00:00.000Z",
        },
    ],
    ownerName: "Lan",
    ledger: [LEDGER],
    canAdjust: role === "owner" || role === "manager",
    adjustmentsReady: true,
    excludedTest: 0,
})

const FIGURES: AccountingBook = {
    invoices: [INVOICE],
    transactions: [],
    orders: [],
    works: [],
    decisions: [],
    adjustments: [],
    adjustmentsReady: true,
}

const ORDERS: AccountingBook = {
    invoices: [],
    transactions: [],
    orders: [WITH_LEAD, WITHOUT_LEAD],
    works: [],
    decisions: [],
    adjustments: [],
    adjustmentsReady: false,
}

const build = async (role: WorkspaceRole, shown: AccountingBook) => {
    const books = mock<AccountingBookService>()
    const members = mock<WorkspaceMembersService>()
    const decisions = mock<DecisionsService>()
    const staff = mock<StaffService>()
    members.require.mockResolvedValue(memberOf(role))
    books.read.mockResolvedValue(shown)
    decisions.listAccountingWaiting.mockResolvedValue([])
    staff.list.mockResolvedValue([STAFF])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountingService,
            { provide: AccountingBookService, useValue: books },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: DecisionsService, useValue: decisions },
            { provide: StaffService, useValue: staff },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(AccountingService), books, members, decisions, staff }
}

describe("AccountingService", () => {
    it("returns the book view after proving membership", async () => {
        const { service, books, members } = await build("staff", ORDERS)

        await expect(service.book("user-1", "ws-1")).resolves.toEqual({
            invoices: [],
            transactions: [],
            orders: [
                {
                    id: "order-1",
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    inboundEventId: null,
                    orderNo: "SO-1",
                    items: "Tea",
                    amountVnd: 1_000,
                    status: "confirmed",
                    origin: "live",
                    confirmedBy: null,
                    confirmedAt: null,
                    createdAt: "2026-10-01T00:00:00.000Z",
                    shippedAt: null,
                    carrier: null,
                    trackingCode: null,
                    lead: { contactName: "Minh", company: "Starci" },
                },
                {
                    id: "order-2",
                    workspaceId: "ws-1",
                    leadId: null,
                    inboundEventId: null,
                    orderNo: "SO-2",
                    items: "Tea",
                    amountVnd: 1_000,
                    status: "confirmed",
                    origin: "live",
                    confirmedBy: null,
                    confirmedAt: null,
                    createdAt: "2026-10-01T00:00:00.000Z",
                    shippedAt: null,
                    carrier: null,
                    trackingCode: null,
                    lead: null,
                },
            ],
            works: [],
            decisions: [],
            adjustments: [],
            adjustmentsReady: false,
        })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(books.read).toHaveBeenCalledWith("ws-1")
    })

    it.each<WorkspaceRole>(["owner", "staff"])("builds the workbench for a %s", async (role) => {
        const { service, books, members, decisions, staff } = await build(role, FIGURES)

        await expect(service.workbench("user-1", "ws-1")).resolves.toEqual(workbenchOf(role))

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(books.read).toHaveBeenCalledWith("ws-1")
        expect(decisions.listAccountingWaiting).toHaveBeenCalledWith("user-1", "ws-1")
        expect(staff.list).toHaveBeenCalledWith("ws-1")
    })

    it("returns the ledger of that workbench", async () => {
        const { service } = await build("owner", FIGURES)

        await expect(service.ledger("user-1", "ws-1")).resolves.toEqual([LEDGER])
    })
})
