import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
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

const WS = "ws-1"
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

const build = async (payables: ReadonlyArray<GatewayPayable>, asked: WorkItem | null = null) => {
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
    const moduleRef = await Test.createTestingModule({
        providers: [
            SupplierPaymentsService,
            { provide: ACCOUNTING_GATEWAY, useValue: gateway },
            { provide: WorkItemsService, useValue: items },
            { provide: AccountingDecisionsService, useValue: decisions },
            { provide: AccountingRoomService, useValue: room },
            { provide: CLOCK, useValue: new FakeClock("2026-10-20T00:00:00Z") },
        ],
    }).compile()
    return { service: moduleRef.get(SupplierPaymentsService), gateway, items, decisions, room }
}

describe("SupplierPaymentsService", () => {
    it("drops a paid invoice, asks once about a partly matching payment and keeps it open until confirmed", async () => {
        const { service, gateway, items, decisions, room } = await build([PAID, UNCLEAR, OPEN])

        await expect(service.openPayables(WS)).resolves.toEqual([UNCLEAR, OPEN])

        expect(gateway.listPaymentDebits).toHaveBeenCalledWith(WS, "2026-08-21T00:00:00.000Z")
        expect(items.findByDedupe).toHaveBeenCalledWith(WS, "confirm_supplier_payment:0100109106:21")
        const text = SUPPLIER_COPY.text("Linh An", "21", 2_000_000, 2_000_000)
        expect(decisions.askSupplierPayment).toHaveBeenCalledWith(WS, {
            payable: UNCLEAR,
            debit: DEBITS[1],
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

    it("counts a confirmed payment as paid and does not ask again", async () => {
        const { service, decisions, room } = await build([UNCLEAR], mock<WorkItem>({ status: "done" }))

        await expect(service.openPayables(WS)).resolves.toEqual([])
        expect(decisions.askSupplierPayment).not.toHaveBeenCalled()
        expect(room.postCard).not.toHaveBeenCalled()
    })

    it("keeps reminding while the decision waits or after a decline", async () => {
        const { service, decisions } = await build([UNCLEAR], mock<WorkItem>({ status: "rejected" }))

        await expect(service.openPayables(WS)).resolves.toEqual([UNCLEAR])
        expect(decisions.askSupplierPayment).not.toHaveBeenCalled()
    })

    it("reads no payments when nothing is open", async () => {
        const { service, gateway } = await build([])

        await expect(service.openPayables(WS)).resolves.toEqual([])
        expect(gateway.listPaymentDebits).not.toHaveBeenCalled()
    })
})
