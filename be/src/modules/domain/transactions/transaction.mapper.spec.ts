import { Test } from "@nestjs/testing"
import { toTransactionRow as realToTransactionRow } from "./transaction.mapper"

const SUBJECT = Symbol("transaction.mapper")
type Subject = { toTransactionRow: typeof realToTransactionRow }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toTransactionRow: realToTransactionRow } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("transaction mapper", () => {
    it("maps a stored payment to the contract row", async () => {
        const subject = await buildSubject()

        expect(
            subject.toTransactionRow({
                id: "tx-1",
                workspaceId: "ws-1",
                inboundEventId: "evt-1",
                amountVnd: 250000,
                reference: "INV-7",
                payer: "Nguyen Van A",
                invoiceId: "inv-7",
                status: "matched",
            }),
        ).toEqual({
            id: "tx-1",
            workspace_id: "ws-1",
            inbound_event_id: "evt-1",
            amount_vnd: 250000,
            reference: "INV-7",
            payer: "Nguyen Van A",
            invoice_id: "inv-7",
            status: "matched",
        })
    })
})
