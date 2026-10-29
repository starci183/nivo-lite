import { toTransactionRow } from "./transaction.mapper"

describe("transaction mapper", () => {
    it("maps a stored payment to the contract row", () => {
        expect(
            toTransactionRow({
                id: "tx-1",
                workspaceId: "ws-1",
                inboundEventId: "evt-1",
                amountVnd: "250000",
                reference: "INV-7",
                payer: "Nguyen Van A",
                invoiceId: "inv-7",
                status: "matched",
            } as never),
        ).toEqual({
            id: "tx-1",
            workspace_id: "ws-1",
            inbound_event_id: "evt-1",
            amount_vnd: "250000",
            reference: "INV-7",
            payer: "Nguyen Van A",
            invoice_id: "inv-7",
            status: "matched",
        })
    })
})
