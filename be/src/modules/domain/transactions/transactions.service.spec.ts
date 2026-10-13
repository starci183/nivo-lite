import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TransactionsErrorCode } from "./errors/transactions.error"
import type { TransactionAccountingRow, TransactionRow } from "./persistence/transactions.rows"
import { LIST_INVOICE_TRANSACTIONS } from "./persistence/transaction-views.sql"
import {
    FIND_TRANSACTION,
    FIND_TRANSACTION_MOMENT,
    INSERT_TRANSACTION,
    LIST_ACCOUNTING_TRANSACTIONS,
    MATCH_TRANSACTION,
    REVIEW_TRANSACTION,
} from "./persistence/transactions.sql"
import type { NewTransaction } from "./transactions.contracts"
import { TransactionsService } from "./transactions.service"

const transactionOf = builder<TransactionRow>({
    id: "tx-1",
    workspace_id: "ws-1",
    inbound_event_id: "in-1",
    amount_vnd: 500000,
    reference: "DH-20261013-0001",
    payer: "Minh",
    invoice_id: null,
    status: "unmatched",
    origin: "live",
})

const payment: NewTransaction = {
    workspaceId: "ws-1",
    inboundEventId: "in-1",
    amountVnd: 500000,
    reference: "DH-20261013-0001",
    payer: "Minh",
    origin: "live",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [TransactionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(TransactionsService)
}

describe("TransactionsService", () => {
    describe("find", () => {
        it("answers the payment of the workspace, or null", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_TRANSACTION, [transactionOf()]],
                    [FIND_TRANSACTION, []],
                ],
            })
            const transactions = await build(em)

            await expect(transactions.find("ws-1", "tx-1")).resolves.toEqual(transactionOf())
            await expect(transactions.find("ws-1", "missing")).resolves.toBeNull()
            expect(em.query.mock.calls).toEqual([
                [FIND_TRANSACTION, ["ws-1", "tx-1"]],
                [FIND_TRANSACTION, ["ws-1", "missing"]],
            ])
        })
    })

    describe("momentOf", () => {
        it("answers the money and the moment of the payment, or null", async () => {
            const moment = { amount_vnd: 500000, payer: "Minh", reference: null, occurred_at: "2026-10-13T02:00:00Z" }
            const em = mockEntityManager({
                query: [
                    [FIND_TRANSACTION_MOMENT, [moment]],
                    [FIND_TRANSACTION_MOMENT, []],
                ],
            })
            const transactions = await build(em)

            await expect(transactions.momentOf("ws-1", "tx-1")).resolves.toEqual(moment)
            await expect(transactions.momentOf("ws-1", "missing")).resolves.toBeNull()
        })
    })

    describe("listForInvoices", () => {
        it("reads nothing for no invoices", async () => {
            const em = mockEntityManager()
            const transactions = await build(em)

            await expect(transactions.listForInvoices("ws-1", [])).resolves.toEqual([])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("reads the payments of the given invoices", async () => {
            const row = {
                ...transactionOf({ invoice_id: "invoice-1", status: "matched" }),
                channel: "bank",
                occurred_at: "2026-10-13T02:00:00Z",
                created_at: "2026-10-13T02:00:01Z",
            }
            const em = mockEntityManager({ query: [LIST_INVOICE_TRANSACTIONS, [row]] })
            const transactions = await build(em)

            await expect(transactions.listForInvoices("ws-1", ["invoice-1"])).resolves.toEqual([row])
            expect(em.query).toHaveBeenCalledWith(LIST_INVOICE_TRANSACTIONS, ["ws-1", ["invoice-1"]])
        })
    })

    describe("listAccounting", () => {
        it("reads the newest payments, a thousand by default", async () => {
            const row: TransactionAccountingRow = {
                ...transactionOf(),
                channel: "bank",
                occurred_at: "2026-10-13T02:00:00Z",
                created_at: "2026-10-13T02:00:01Z",
                inbound: null,
            }
            const em = mockEntityManager({
                query: [
                    [LIST_ACCOUNTING_TRANSACTIONS, [row]],
                    [LIST_ACCOUNTING_TRANSACTIONS, []],
                ],
            })
            const transactions = await build(em)

            await expect(transactions.listAccounting("ws-1")).resolves.toEqual([row])
            await expect(transactions.listAccounting("ws-1", 20)).resolves.toEqual([])
            expect(em.query.mock.calls).toEqual([
                [LIST_ACCOUNTING_TRANSACTIONS, ["ws-1", 1000]],
                [LIST_ACCOUNTING_TRANSACTIONS, ["ws-1", 20]],
            ])
        })
    })

    describe("open", () => {
        it("records an unmatched payment and answers it", async () => {
            const em = mockEntityManager({ query: [INSERT_TRANSACTION, [transactionOf()]] })
            const transactions = await build(em)

            await expect(transactions.open(payment)).resolves.toEqual(transactionOf())
            expect(em.query).toHaveBeenCalledWith(INSERT_TRANSACTION, [
                "ws-1",
                "in-1",
                500000,
                "DH-20261013-0001",
                "Minh",
                "live",
            ])
        })

        it("refuses when no row was created", async () => {
            const transactions = await build(mockEntityManager({ query: [INSERT_TRANSACTION, []] }))

            await expect(transactions.open(payment)).rejects.toMatchObject({
                code: TransactionsErrorCode.NotCreated,
            })
        })
    })

    describe("match and sendToReview", () => {
        it("settles the invoice with the payment and then sends the payment back to review", async () => {
            const em = mockEntityManager({
                query: [
                    [MATCH_TRANSACTION, []],
                    [REVIEW_TRANSACTION, []],
                ],
            })
            const transactions = await build(em)

            await transactions.match("ws-1", "tx-1", "invoice-1")
            await transactions.sendToReview("ws-1", "tx-1")

            expect(em.query.mock.calls).toEqual([
                [MATCH_TRANSACTION, ["ws-1", "tx-1", "invoice-1"]],
                [REVIEW_TRANSACTION, ["ws-1", "tx-1"]],
            ])
        })
    })
})
