import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { Proposal, WorkItem } from "@modules/domain/decisions"
import { SupplierPayablesService } from "@modules/domain/supplier-payables"
import { CLOCK } from "@modules/platform/clock"
import { AccountingErrorCode } from "./errors/accounting.error"
import { SupplierPaymentPerformerService } from "./supplier-payment-performer.service"

const CTX = { workspaceId: "ws-1", actor: "Lan", locale: "vi" as const }
const NOW = "2026-10-20T01:00:00.000Z"

const proposalOf = (fields: Proposal["fields"]): Proposal => ({
    summary: "Paid Linh An",
    amount_vnd: 4_620_000,
    fields,
})
const FIELDS = { invoice_no: "17", seller_tax_code: "0100109106", debit_ref: "d-1" }
const itemOf = (subjectId: string | null): WorkItem =>
    mock<WorkItem>({ id: "wi-1", lead_id: null, subject_id: subjectId, proposal: proposalOf(FIELDS) })

const build = async (marked = true) => {
    const payables = mock<SupplierPayablesService>({ markPaid: jest.fn(() => Promise.resolve(marked)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            SupplierPaymentPerformerService,
            { provide: SupplierPayablesService, useValue: payables },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { performer: moduleRef.get(SupplierPaymentPerformerService), payables }
}

describe("SupplierPaymentPerformerService", () => {
    it("keeps the proposal the morning run preset", async () => {
        const { performer } = await build()
        const item = itemOf("pay-1")

        await expect(performer.prepare(CTX, item)).resolves.toEqual({ proposal: item.proposal })
    })

    it("marks the invoice row paid with the payment, the time and who decided", async () => {
        const { performer, payables } = await build()

        await expect(performer.perform(CTX, itemOf("pay-1"), proposalOf(FIELDS))).resolves.toEqual({
            summary: "Paid Linh An",
            evidence: "captured",
            lead_id: null,
            detail: "d-1",
        })

        expect(payables.markPaid).toHaveBeenCalledWith("ws-1", "pay-1", {
            debitRef: "d-1",
            paidAt: new Date(NOW),
            workItemId: "wi-1",
            decidedBy: "Lan",
        })
    })

    it("succeeds again on a retry: the row stays as it is", async () => {
        const { performer } = await build(false)

        await expect(performer.perform(CTX, itemOf("pay-1"), proposalOf(FIELDS))).resolves.toMatchObject({
            detail: "d-1",
        })
    })

    it.each([
        { name: "no invoice row", subject: null, fields: FIELDS },
        { name: "no payment", subject: "pay-1", fields: { ...FIELDS, debit_ref: 7 } },
    ])("fails the item with $name", async ({ subject, fields }) => {
        const { performer, payables } = await build()

        await expect(performer.perform(CTX, itemOf(subject), proposalOf(fields))).rejects.toMatchObject({
            code: AccountingErrorCode.PaymentInvalid,
            params: { item: "wi-1" },
        })
        expect(payables.markPaid).not.toHaveBeenCalled()
    })
})
