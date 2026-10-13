import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { FIND_TRANSACTION } from "./persistence/transactions.sql"
import type { TransactionRow } from "./persistence/transactions.rows"
import { TransactionsService } from "./transactions.service"

const row: TransactionRow = {
    id: "tx-1",
    workspace_id: "ws-1",
    inbound_event_id: null,
    amount_vnd: 1500,
    reference: "DH1",
    payer: "Lan",
    invoice_id: null,
    status: "unmatched",
    origin: "live",
}

describe("TransactionsService", () => {
    const build = async () => {
        const em = mockEntityManager()
        const moduleRef = await Test.createTestingModule({
            providers: [TransactionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()
        return { service: moduleRef.get(TransactionsService), em }
    }

    it("reads the payment of the workspace", async () => {
        const { service, em } = await build()
        em.query.mockResolvedValue([row])

        await expect(service.find("ws-1", "tx-1")).resolves.toEqual(row)
        expect(em.query).toHaveBeenCalledWith(FIND_TRANSACTION, ["ws-1", "tx-1"])
    })

    it("answers no payments when no invoice is named", async () => {
        const { service, em } = await build()

        await expect(service.listForInvoices("ws-1", [])).resolves.toEqual([])
        expect(em.query).not.toHaveBeenCalled()
    })
})
