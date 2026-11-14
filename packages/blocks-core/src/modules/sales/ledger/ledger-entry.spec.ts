import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { ORDER, TRANSACTION } from "../../../rules/sales/ledger/accounting.fixtures"
import { memoryProvider, memoryWorld, putLead, putOrder, putTransaction } from "./fixtures/accounting.memory"
import type { MemoryWorld } from "./fixtures/accounting.memory"
import { ledgerEntryOf } from "./ledger-entry"
import { LEADS, ORDERS, TRANSACTIONS } from "./ports"

/** The records of a world, as the ledger line reads them. */
const portsOf = (world: MemoryWorld) => {
    const provider = memoryProvider(world)
    return {
        transactions: provider.implementationOf(TRANSACTIONS) as EntityApi,
        orders: provider.implementationOf(ORDERS) as EntityApi,
        leads: provider.implementationOf(LEADS) as EntityApi,
    }
}

/** A payment that paid the order of the customer Dinh, or one that paid nothing yet. */
const worldOf = (paidOrder: boolean): MemoryWorld => {
    const world = memoryWorld()
    putTransaction(world, { ...TRANSACTION, orderId: paidOrder ? ORDER.id : null, status: paidOrder ? "matched" : "unmatched" })
    putOrder(world, { ...ORDER, status: "paid" })
    putLead(world, "00000000-0000-4000-8000-0000000000e9", "Dinh", ORDER.contactId ?? "")
    return world
}

describe("ledgerEntryOf: the ledger line of a bank transaction (the sales module's own, moved from the engine's append by transaction id)", () => {
    it("builds the line from the transaction and the order it paid", async () => {
        const built = await ledgerEntryOf(portsOf(worldOf(true)), TRANSACTION.id)

        expect(built).toMatchObject({
            entry: {
                orderNo: ORDER.orderNo,
                amountVnd: TRANSACTION.amountVnd,
                transactionId: TRANSACTION.id,
                status: "paid",
                direction: "in",
                category: "sale",
            },
        })
    })

    it("gives no line for a transaction that paid nothing yet, and for one that is not there", async () => {
        await expect(ledgerEntryOf(portsOf(worldOf(false)), TRANSACTION.id)).resolves.toEqual({ refused: "transaction_not_settled" })
        await expect(ledgerEntryOf(portsOf(worldOf(true)), "00000000-0000-4000-8000-00000000ffff")).resolves.toEqual({
            refused: "transaction_missing",
        })
    })
})
