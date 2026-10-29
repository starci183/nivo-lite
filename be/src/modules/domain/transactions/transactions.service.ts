import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import { TransactionsError, TransactionsErrorCode } from "./errors/transactions.error"
import { TransactionEntity } from "./persistence/entities"
import { toTransactionRow } from "./transaction.mapper"
import type {
    BankCreditQuery,
    BankCreditRow,
    BankDirection,
    NewTransaction,
    OptionalTransaction,
    OptionalTransactionMoment,
    TransactionAccountingRow,
    TransactionMoment,
    TransactionRow,
    TransactionViewRow,
} from "./transactions.contracts"

/** Renders a timestamptz column as the `to_json` text (`+00:00`, microseconds) the contracts always carried. */
const TEXT_TIMESTAMP = (column: string): string => `to_json(${column}) #>> '{}'`

/** The most payments one invoice read returns. */
const INVOICE_TRANSACTIONS_MAX = 1000

/** One accounting row as the statement selects it, before its input is attached. */
interface AccountingRawRow {
    /** The transaction id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The input the payment arrived as. */
    readonly inbound_event_id: string | null
    /** The payment channel. */
    readonly channel: string
    /** The money, VND (cast to float8 in the select). */
    readonly amount_vnd: number
    /** The transfer content. */
    readonly reference: string | null
    /** The payer's name. */
    readonly payer: string | null
    /** The invoice it settled. */
    readonly invoice_id: string | null
    /** The lifecycle state. */
    readonly status: string
    /** When the payment occurred, ISO text as `to_json` renders it. */
    readonly occurred_at: string
    /** When it was written, ISO text as `to_json` renders it. */
    readonly created_at: string
}

/** True when a RETURNING row carries the columns of a transaction contract row. */
const isReturnedRow = (value: unknown): value is TransactionRow =>
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.workspace_id === "string" &&
    typeof value.amount_vnd === "number" &&
    typeof value.status === "string"

/** The transaction rows a write answered. */
const returnedRows = (raw: unknown): Array<TransactionRow> => (Array.isArray(raw) ? raw.filter(isReturnedRow) : [])

@Injectable()
/** The payments of a workspace as the ledger sees them: the only writer of public.transactions. */
export class TransactionsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly inputs: InboundEventsService,
    ) {}

    /** The transaction of the workspace, or null when there is none with that id. */
    async find(workspaceId: string, transactionId: string): Promise<OptionalTransaction> {
        const row = await this.entityManager.findOne(TransactionEntity, {
            where: { workspaceId, id: transactionId },
        })
        return row === null ? null : toTransactionRow(row)
    }

    /** The money and the moment of a payment, or null when the workspace has no such payment. */
    async momentOf(workspaceId: string, transactionId: string): Promise<OptionalTransactionMoment> {
        const row = await this.entityManager
            .createQueryBuilder(TransactionEntity, "t")
            .select([
                "t.amount_vnd::float8 AS amount_vnd",
                "t.payer AS payer",
                "t.reference AS reference",
                `${TEXT_TIMESTAMP("t.occurred_at")} AS occurred_at`,
            ])
            .where("t.workspace_id = :workspaceId AND t.id = :transactionId", { workspaceId, transactionId })
            .limit(1)
            .getRawOne<TransactionMoment>()
        return row ?? null
    }

    /** The payments linked to a customer's invoices, after the composer proved workspace membership. */
    listForInvoices(workspaceId: string, invoiceIds: ReadonlyArray<string>): Promise<Array<TransactionViewRow>> {
        if (invoiceIds.length === 0) return Promise.resolve([])
        return this.entityManager
            .createQueryBuilder(TransactionEntity, "t")
            .select([
                "t.id AS id",
                "t.workspace_id AS workspace_id",
                "t.inbound_event_id AS inbound_event_id",
                "t.amount_vnd::float8 AS amount_vnd",
                "t.reference AS reference",
                "t.payer AS payer",
                "t.invoice_id AS invoice_id",
                "t.status AS status",
                "t.channel AS channel",
                `${TEXT_TIMESTAMP("t.occurred_at")} AS occurred_at`,
                `${TEXT_TIMESTAMP("t.created_at")} AS created_at`,
            ])
            .where("t.workspace_id = :workspaceId AND t.invoice_id IN (:...invoiceIds)", {
                workspaceId,
                invoiceIds: [...invoiceIds],
            })
            .orderBy("t.created_at", "ASC")
            .addOrderBy("t.id", "ASC")
            .limit(INVOICE_TRANSACTIONS_MAX)
            .getRawMany<TransactionViewRow>()
    }

    /** The newest payments and their input records for the accounting book. */
    async listAccounting(workspaceId: string, limit: number = 1000): Promise<Array<TransactionAccountingRow>> {
        const rows = await this.entityManager
            .createQueryBuilder(TransactionEntity, "t")
            .select([
                "t.id AS id",
                "t.workspace_id AS workspace_id",
                "t.inbound_event_id AS inbound_event_id",
                "t.channel AS channel",
                "t.amount_vnd::float8 AS amount_vnd",
                "t.reference AS reference",
                "t.payer AS payer",
                "t.invoice_id AS invoice_id",
                "t.status AS status",
                `${TEXT_TIMESTAMP("t.occurred_at")} AS occurred_at`,
                `${TEXT_TIMESTAMP("t.created_at")} AS created_at`,
            ])
            .where("t.workspace_id = :workspaceId", { workspaceId })
            .orderBy("t.occurred_at", "DESC")
            .addOrderBy("t.id", "DESC")
            .limit(limit)
            .getRawMany<AccountingRawRow>()
        const inputs = await this.inputs.findMany(
            workspaceId,
            rows.flatMap((row) => (row.inbound_event_id === null ? [] : [row.inbound_event_id])),
        )
        const inputOf = new Map(inputs.map((input) => [input.id, input]))
        return rows.map((row) => {
            const input = inputOf.get(row.inbound_event_id ?? "")
            return {
                id: row.id,
                workspace_id: row.workspace_id,
                inbound_event_id: row.inbound_event_id,
                channel: row.channel,
                amount_vnd: row.amount_vnd,
                reference: row.reference,
                payer: row.payer,
                invoice_id: row.invoice_id,
                status: row.status,
                occurred_at: row.occurred_at,
                created_at: row.created_at,
                inbound:
                    input === undefined
                        ? null
                        : {
                              channel: input.channel,
                              event_id: input.event_id,
                              body: input.body,
                              sender_name: input.sender_name,
                          },
            }
        })
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
        const result = await manager
            .createQueryBuilder(TransactionEntity, "t")
            .insert()
            .values({
                workspaceId: input.workspaceId,
                inboundEventId: input.inboundEventId,
                channel: "bank",
                amountVnd: input.amountVnd,
                reference: input.reference,
                payer: input.payer,
                status: "unmatched",
                direction: input.direction ?? "credit",
            })
            .returning(
                "id, workspace_id, inbound_event_id, amount_vnd::float8 AS amount_vnd, reference, payer, invoice_id, status",
            )
            .execute()
        const created = returnedRows(result.raw)[0]
        if (created === undefined) throw new TransactionsError({ code: TransactionsErrorCode.NotCreated })
        return created
    }

    private listBankMoves(query: BankCreditQuery, direction: BankDirection): Promise<Array<BankCreditRow>> {
        const read = this.entityManager
            .createQueryBuilder(TransactionEntity, "t")
            .select([
                "t.id AS id",
                "t.amount_vnd::float8 AS amount_vnd",
                "t.reference AS reference",
                "t.payer AS payer",
                "t.status AS status",
                `${TEXT_TIMESTAMP("t.occurred_at")} AS occurred_at`,
            ])
            .where("t.workspace_id = :workspaceId AND t.channel = 'bank' AND t.direction = :direction", {
                workspaceId: query.workspaceId,
                direction,
            })
        if (query.status !== null) read.andWhere("t.status = :status", { status: query.status })
        if (query.since !== null) read.andWhere("t.occurred_at >= :since", { since: new Date(query.since) })
        return read
            .orderBy("t.occurred_at", "DESC")
            .addOrderBy("t.id", "DESC")
            .limit(query.limit)
            .getRawMany<BankCreditRow>()
    }

    /** The payment settled an invoice. */
    async match(
        workspaceId: string,
        transactionId: string,
        invoiceId: string,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.update(TransactionEntity, { workspaceId, id: transactionId }, { status: "matched", invoiceId })
    }

    /** The payment goes back to the owner's review. */
    async sendToReview(workspaceId: string, transactionId: string): Promise<void> {
        await this.entityManager.update(
            TransactionEntity,
            { workspaceId, id: transactionId },
            { status: "needs_review" },
        )
    }
}
