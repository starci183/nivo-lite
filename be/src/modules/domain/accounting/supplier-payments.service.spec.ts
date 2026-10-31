import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { SupplierPayablesService } from "@modules/domain/supplier-payables"
import type { NewSupplierPayable, SupplierPayableRow } from "@modules/domain/supplier-payables"
import { WorkItemsService } from "@modules/domain/work-items"
import type { WorkItem } from "@modules/domain/work-items"
import { CLOCK } from "@modules/platform/clock"
import type { GatewayPayable, HubCardPayload } from "./accounting-desk.contracts"
import { AccountingDecisionsService } from "./accounting-decisions.service"
import { ACCOUNTING_GATEWAY } from "./accounting-gateway.decorators"
import type { AccountingGateway, PaymentCredit } from "./accounting-gateway.port"
import { AccountingRoomService } from "./accounting-room.service"
import { SUPPLIER_COPY } from "./messages/accounting-desk.messages"
import { SupplierPaymentsService } from "./supplier-payments.service"
import type { SupplierTerms } from "./supplier-payments.service"

const WS = "ws-1"
const TERMS: SupplierTerms = { suppliers: [], defaultTermDays: 30 }
const PAID: GatewayPayable = {
    supplier: "Linh An",
    sellerTaxCode: "0100109106",
    invoiceNo: "17",
    amountVnd: 4_620_000,
    issuedOn: "2026-10-01",
}
const UNCLEAR: GatewayPayable = { ...PAID, invoiceNo: "21", amountVnd: 2_000_000 }
const OPEN: GatewayPayable = { ...PAID, invoiceNo: "30", amountVnd: 9_000_000 }
const DEBITS: ReadonlyArray<PaymentCredit> = [
    { creditRef: "d-1", reference: "TT HD 17", amountVnd: 4_620_000, occurredAt: "", matched: true },
    { creditRef: "d-2", reference: "chuyen tien NCC", amountVnd: 2_000_000, occurredAt: "", matched: false },
]

const rowOf = (payable: GatewayPayable, status: "open" | "paid" = "open"): SupplierPayableRow => ({
    id: `row-${payable.invoiceNo}`,
    supplier: payable.supplier,
    sellerTaxCode: payable.sellerTaxCode,
    invoiceNo: payable.invoiceNo,
    amountVnd: payable.amountVnd,
    issuedOn: payable.issuedOn,
    dueOn: "2026-10-31",
    status,
    debitRef: status === "paid" ? "d-1" : null,
    paidAt: status === "paid" ? "2026-10-10T00:00:00.000Z" : null,
    workItemId: null,
    firstSeenAt: "2026-10-20T00:00:00.000Z",
    decidedBy: null,
})

interface BuildOptions {
    /** The work item already opened for an invoice, by its dedupe key. */
    readonly asked?: WorkItem | null
    /** The rows after the desk has asked: what is still open. */
    readonly stillOpen?: ReadonlyArray<GatewayPayable>
    /** The status of the rows the record step answers. */
    readonly status?: "open" | "paid"
}

const build = async (payables: ReadonlyArray<GatewayPayable>, options: BuildOptions = {}) => {
    const { asked = null, status = "open" } = options
    const stillOpen = options.stillOpen ?? payables
    const gateway = mock<AccountingGateway>({
        listOpenPayables: jest.fn(() => Promise.resolve(payables)),
        listPaymentDebits: jest.fn(() => Promise.resolve({ tool: "bank.debits.list", value: DEBITS })),
    })
    const items = mock<WorkItemsService>({ findByDedupe: jest.fn(() => Promise.resolve(asked)) })
    const decisions = mock<AccountingDecisionsService>({
        askSupplierPayment: jest.fn(() => Promise.resolve({ kind: "work_item" as const, id: "wi-7" })),
    })
    const room = mock<AccountingRoomService>({
        postCard: jest.fn((_workspaceId: string, card: HubCardPayload) => Promise.resolve(card)),
    })
    const stored = mock<SupplierPayablesService>({
        record: jest.fn((_workspaceId: string, listed: ReadonlyArray<NewSupplierPayable>) =>
            Promise.resolve(listed.map((payable) => rowOf(payable, status))),
        ),
        listOpen: jest.fn(() => Promise.resolve(stillOpen.map((payable) => rowOf(payable)))),
        linkWork: jest.fn(() => Promise.resolve()),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            SupplierPaymentsService,
            { provide: ACCOUNTING_GATEWAY, useValue: gateway },
            { provide: WorkItemsService, useValue: items },
            { provide: AccountingDecisionsService, useValue: decisions },
            { provide: AccountingRoomService, useValue: room },
            { provide: SupplierPayablesService, useValue: stored },
            { provide: CLOCK, useValue: new FakeClock("2026-10-20T00:00:00Z") },
        ],
    }).compile()
    return { service: moduleRef.get(SupplierPaymentsService), gateway, items, decisions, room, stored }
}

const registerMatching = () => {
    it("keeps every listed invoice as a row, with its due date from the supplier term", async () => {
        const { service, stored } = await build([PAID, OPEN])

        await service.openPayables(WS, { suppliers: [{ name: "linh-an", taxCode: "0100109106", termDays: 7 }], defaultTermDays: 30 })

        expect(stored.record).toHaveBeenCalledWith(WS, [
            { ...PAID, dueOn: "2026-10-08" },
            { ...OPEN, dueOn: "2026-10-08" },
        ])
    })

    it("sends an exact match through the work engine with no forced ask, and posts no card for it", async () => {
        const { service, decisions, room, stored } = await build([PAID], { stillOpen: [] })

        await expect(service.openPayables(WS, TERMS)).resolves.toEqual([])

        const text = SUPPLIER_COPY.exactText("Linh An", "17", 4_620_000)
        expect(decisions.askSupplierPayment).toHaveBeenCalledWith(WS, {
            payable: PAID,
            debit: DEBITS[0],
            payableId: "row-17",
            unclear: false,
            summary: text,
        })
        expect(stored.linkWork).toHaveBeenCalledWith(WS, "row-17", "wi-7")
        expect(room.postCard).not.toHaveBeenCalled()
    })

    it("asks once about a partly matching payment, forces a person, and keeps it open until confirmed", async () => {
        const { service, gateway, items, decisions, room } = await build([PAID, UNCLEAR, OPEN], {
            stillOpen: [UNCLEAR, OPEN],
        })

        await expect(service.openPayables(WS, TERMS)).resolves.toEqual([UNCLEAR, OPEN])

        expect(gateway.listPaymentDebits).toHaveBeenCalledWith(WS, "2026-08-21T00:00:00.000Z")
        expect(items.findByDedupe).toHaveBeenCalledWith(WS, "confirm_supplier_payment:0100109106:21")
        const text = SUPPLIER_COPY.text("Linh An", "21", 2_000_000, 2_000_000)
        expect(decisions.askSupplierPayment).toHaveBeenCalledWith(WS, {
            payable: UNCLEAR,
            debit: DEBITS[1],
            payableId: "row-21",
            unclear: true,
            summary: text,
        })
        const [, card, posted] = room.postCard.mock.calls[0] ?? []
        expect(posted).toBe(text)
        expect(card).toEqual(
            expect.objectContaining({
                type: "exception",
                ref: { kind: "work_item", id: "wi-7" },
                actions: ["approve", "decline"],
                data: { invoiceNo: "21", sellerTaxCode: "0100109106", debitRef: "d-2" },
            }),
        )
        expect(card?.sources?.map((source) => source.ref)).toEqual(["bank.debits.list"])
    })
}

const registerKeepingOpen = () => {
    it("asks nothing about an invoice that is already paid", async () => {
        const { service, decisions, room, items } = await build([PAID, UNCLEAR], { status: "paid", stillOpen: [] })

        await expect(service.openPayables(WS, TERMS)).resolves.toEqual([])

        expect(items.findByDedupe).not.toHaveBeenCalled()
        expect(decisions.askSupplierPayment).not.toHaveBeenCalled()
        expect(room.postCard).not.toHaveBeenCalled()
    })

    it("asks nothing twice and keeps reminding while the decision waits or after a decline", async () => {
        const { service, decisions, room } = await build([UNCLEAR], { asked: mock<WorkItem>({ status: "rejected" }) })

        await expect(service.openPayables(WS, TERMS)).resolves.toEqual([UNCLEAR])
        expect(decisions.askSupplierPayment).not.toHaveBeenCalled()
        expect(room.postCard).not.toHaveBeenCalled()
    })

    it("reads no payments and writes no row when nothing is listed", async () => {
        const { service, gateway, stored } = await build([])

        await expect(service.openPayables(WS, TERMS)).resolves.toEqual([])
        expect(gateway.listPaymentDebits).not.toHaveBeenCalled()
        expect(stored.record).not.toHaveBeenCalled()
    })
}

describe("SupplierPaymentsService", () => {
    registerMatching()
    registerKeepingOpen()
})
