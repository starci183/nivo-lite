import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { TransactionsError, TransactionsErrorCode } from "./errors/transactions.error"
import type { BankCreditRow, TransactionAccountingRow, TransactionRow } from "./persistence/transactions.rows"
import type { TransactionViewRow } from "./persistence/transaction-views.rows"
import { LIST_INVOICE_TRANSACTIONS } from "./persistence/transaction-views.sql"
import {
    FIND_TRANSACTION,
    FIND_TRANSACTION_MOMENT,
    INSERT_TRANSACTION,
    LIST_ACCOUNTING_TRANSACTIONS,
    LIST_BANK_MOVES,
    MATCH_TRANSACTION,
    REVIEW_TRANSACTION,
} from "./persistence/transactions.sql"
import type {
    BankCreditQuery,
    BankDirection,
    NewTransaction,
    OptionalTransaction,
    OptionalTransactionMoment,
    TransactionMoment,
} from "./transactions.contracts"

@Injectable()
/** The payments of a workspace as the ledger sees them: the only writer of public.transactions. */
export class TransactionsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The transaction of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, transactionId: string): Promise<OptionalTransaction> {
        const rows = await this.entityManager.query<Array<TransactionRow>>(FIND_TRANSACTION, [
            workspaceId,
            transactionId,
        ])
        return rows[0] ?? null
    }

    /** The money and the moment of a payment, or null when the workspace has no such payment. */
    async momentOf(workspaceId: string, transactionId: string): Promise<OptionalTransactionMoment> {
        const rows = await this.entityManager.query<Array<TransactionMoment>>(FIND_TRANSACTION_MOMENT, [
            workspaceId,
            transactionId,
        ])
        return rows[0] ?? null
    }

    /** The payments linked to a customer's invoices, after the composer proved workspace membership. */
    listForInvoices(workspaceId: string, invoiceIds: ReadonlyArray<string>): Promise<Array<TransactionViewRow>> {
        if (invoiceIds.length === 0) return Promise.resolve([])
        return this.entityManager.query<Array<TransactionViewRow>>(LIST_INVOICE_TRANSACTIONS, [workspaceId, invoiceIds])
    }

    /** The newest payments and their input records for the accounting book. */
    listAccounting(workspaceId: string, limit: number = 1000): Promise<Array<TransactionAccountingRow>> {
        return this.entityManager.query<Array<TransactionAccountingRow>>(LIST_ACCOUNTING_TRANSACTIONS, [
            workspaceId,
            limit,
        ])
    }

    /** The newest live bank credits of a workspace, optionally of one status and from an instant. */
    listBankCredits(query: BankCreditQuery): Promise<Array<BankCreditRow>> {
        return this.listBankMoves(query, "credit")
    }

    /** The newest live bank debits (money out, for example supplier payments) of a workspace, filtered like the credits. */
    listBankDebits(query: BankCreditQuery): Promise<Array<BankCreditRow>> {
        return this.listBankMoves(query, "debit")
    }

    /**
     * Records a live payment nobody matched yet; NIVO records no other kind. Inside the caller's transaction when it hands one
     * (the bank feed books a move atomically with its receipt).
     */
    async open(input: NewTransaction, manager: EntityManager = this.entityManager): Promise<TransactionRow> {
        const rows = await manager.query<Array<TransactionRow>>(INSERT_TRANSACTION, [
            input.workspaceId,
            input.inboundEventId,
            input.amountVnd,
            input.reference,
            input.payer,
            input.direction ?? "credit",
        ])
        const [created] = rows
        if (created === undefined) throw new TransactionsError({ code: TransactionsErrorCode.NotCreated })
        return created
    }

    private listBankMoves(query: BankCreditQuery, direction: BankDirection): Promise<Array<BankCreditRow>> {
        return this.entityManager.query<Array<BankCreditRow>>(LIST_BANK_MOVES, [
            query.workspaceId,
            query.status,
            query.since,
            query.limit,
            direction,
        ])
    }

    /** The payment settled an invoice. */
    async match(workspaceId: string, transactionId: string, invoiceId: string): Promise<void> {
        await this.entityManager.query(MATCH_TRANSACTION, [workspaceId, transactionId, invoiceId])
    }

    /** The payment goes back to the owner's review. */
    async sendToReview(workspaceId: string, transactionId: string): Promise<void> {
        await this.entityManager.query(REVIEW_TRANSACTION, [workspaceId, transactionId])
    }
}
