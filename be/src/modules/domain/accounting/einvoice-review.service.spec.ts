import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EinvoiceDraft, HubCardPayload, InvoiceQuestion, TaxProfile } from "./accounting-desk.contracts"
import { AccountingDecisionsService } from "./accounting-decisions.service"
import { ACCOUNTING_GATEWAY } from "./accounting-gateway.decorators"
import type { AccountingGateway, GatewayEinvoice } from "./accounting-gateway.port"
import { AccountingRoomService } from "./accounting-room.service"
import { EinvoiceReviewService } from "./einvoice-review.service"
import { EXCEPTION_COPY } from "./messages/accounting-desk.messages"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const itemsLike = (items: ReadonlyArray<unknown>): unknown => expect.arrayContaining(items)

const WS = "ws-1"

const PROFILE: TaxProfile = {
    taxCode: "0108896128",
    vatPeriod: "quarterly",
    withholdsPit: true,
    paysLicenseFee: true,
    establishedYear: 2019,
    reminderDays: 7,
    supplierTermDays: 30,
}

const draft = (overrides: Partial<EinvoiceDraft> = {}): EinvoiceDraft => ({
    source: "xml",
    template: "1",
    series: "C26TLA",
    invoiceNo: "17",
    issuedOn: "2026-10-19",
    sellerName: "Linh An",
    sellerTaxCode: "0100109106",
    buyerName: "Guesthouse",
    buyerTaxCode: "0108896128",
    lines: [{ name: "Towel", quantity: 20, amountVnd: 2_000_000, vatRate: 10 }],
    subtotalVnd: 2_000_000,
    vatVnd: 200_000,
    totalVnd: 2_200_000,
    ...overrides,
})

const build = async (received: ReadonlyArray<GatewayEinvoice>) => {
    const gateway = mock<AccountingGateway>({
        listEinvoices: jest.fn(() => Promise.resolve({ tool: "inbox.invoices.list", value: received })),
    })
    const room = mock<AccountingRoomService>({
        postCard: jest.fn((_workspaceId: string, card: HubCardPayload) => Promise.resolve(card)),
    })
    const decisions = mock<AccountingDecisionsService>({
        askInvoiceReview: jest.fn((_workspaceId: string, question: InvoiceQuestion) =>
            Promise.resolve({ kind: "work_item" as const, id: `wi-${question.ref}` }),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            EinvoiceReviewService,
            { provide: ACCOUNTING_GATEWAY, useValue: gateway },
            { provide: AccountingRoomService, useValue: room },
            { provide: AccountingDecisionsService, useValue: decisions },
        ],
    }).compile()
    return { service: moduleRef.get(EinvoiceReviewService), gateway, room, decisions }
}

describe("EinvoiceReviewService", () => {
    it("counts the verdicts and raises every invoice that is not valid", async () => {
        const suppliers = [{ name: "Linh An", taxCode: "0100109106-001", termDays: null }]
        const { service, gateway, room, decisions } = await build([
            { ref: "a", draft: draft({ sellerName: "Other" }) },
            { ref: "b", draft: draft() },
            { ref: "c", draft: draft({ sellerName: "Other", vatVnd: 1, totalVnd: 2_000_001 }) },
        ])

        await expect(service.review(WS, PROFILE, suppliers, new Date("2026-10-19T23:30:00Z"))).resolves.toEqual({
            valid: 1,
            needsReview: 1,
            invalidTaxCode: 1,
            tool: "inbox.invoices.list",
        })
        expect(gateway.listEinvoices).toHaveBeenCalledWith(WS, "2026-10-19T23:30:00.000Z")
        expect(room.postCard).toHaveBeenCalledTimes(2)
        expect(decisions.askInvoiceReview).toHaveBeenCalledTimes(2)
        expect(decisions.askInvoiceReview).toHaveBeenCalledWith(WS, expect.objectContaining({ ref: "b" }))
        expect(room.postCard).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({
                type: "exception",
                ref: { kind: "work_item", id: "wi-b" },
                actions: ["approve", "decline"],
                sources: itemsLike([objectLike({ ref: "inbox.invoices.list" })]),
            }),
            expect.stringContaining(EXCEPTION_COPY.onFile("0100109106", "0100109106-001")),
        )
    })
})
