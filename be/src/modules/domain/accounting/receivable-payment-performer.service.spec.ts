import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Proposal, WorkItem } from "@modules/domain/decisions"
import { ACCOUNTING_GATEWAY } from "./accounting-gateway.decorators"
import type { AccountingGateway } from "./accounting-gateway.port"
import { AccountingErrorCode } from "./errors/accounting.error"
import { ReceivablePaymentPerformerService } from "./receivable-payment-performer.service"

const CTX = { workspaceId: "ws-1", actor: "Lan", locale: "vi" as const }

const proposalOf = (fields: Proposal["fields"], amount: number | null = 5_000_000): Proposal => ({
    summary: "Payment differs",
    amount_vnd: amount,
    fields,
})
const FIELDS = { receivable_id: "rc-1", credit_ref: "SP-9", reference: "CK PAY F7K2Q9" }
const ITEM = mock<WorkItem>({ id: "wi-1", lead_id: null, proposal: proposalOf(FIELDS) })

const build = async (recorded = true) => {
    const gateway = mock<AccountingGateway>({ recordPayment: jest.fn(() => Promise.resolve(recorded)) })
    const moduleRef = await Test.createTestingModule({
        providers: [ReceivablePaymentPerformerService, { provide: ACCOUNTING_GATEWAY, useValue: gateway }],
    }).compile()
    return { performer: moduleRef.get(ReceivablePaymentPerformerService), gateway }
}

describe("ReceivablePaymentPerformerService", () => {
    it("keeps the proposal the reconcile preset", async () => {
        const { performer } = await build()

        await expect(performer.prepare(CTX, ITEM)).resolves.toEqual({ proposal: ITEM.proposal })
    })

    it("records the approved credit on its receivable by role", async () => {
        const { performer, gateway } = await build()

        await expect(performer.perform(CTX, ITEM, proposalOf(FIELDS))).resolves.toEqual({
            summary: "Payment differs",
            evidence: "captured",
            lead_id: null,
            detail: "SP-9",
        })
        expect(gateway.recordPayment).toHaveBeenCalledWith("ws-1", {
            receivableId: "rc-1",
            creditRef: "SP-9",
            amountVnd: 5_000_000,
        })
    })

    it("fails the item when the connector did not record the payment", async () => {
        const { performer } = await build(false)

        await expect(performer.perform(CTX, ITEM, proposalOf(FIELDS))).rejects.toMatchObject({
            code: AccountingErrorCode.PaymentNotRecorded,
            params: { credit: "SP-9" },
        })
    })

    it.each([
        { name: "no receivable", fields: { ...FIELDS, receivable_id: 7 }, amount: 1 },
        { name: "no credit", fields: { ...FIELDS, credit_ref: "" }, amount: 1 },
        { name: "no amount", fields: FIELDS, amount: null },
    ])("refuses a proposal with $name and records nothing", async ({ fields, amount }) => {
        const { performer, gateway } = await build()

        await expect(performer.perform(CTX, ITEM, proposalOf(fields, amount))).rejects.toMatchObject({
            code: AccountingErrorCode.PaymentInvalid,
            params: { item: "wi-1" },
        })
        expect(gateway.recordPayment).not.toHaveBeenCalled()
    })
})
