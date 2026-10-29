import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { TransactionEntity } from "./persistence/entities"
import type { LedgerPayment, PaymentTally, ReceiptPayment } from "./transactions-ledger.contracts"

@Injectable()
/** The money-in figures and ledger lines the n8n workflows and other report readers ask for, always bounded by the caller. */
export class TransactionsLedgerService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** How many credits arrived in the period and what they add up to. */
    async creditTally(workspaceId: string, from: Date, to: Date): Promise<PaymentTally> {
        const row = await this.entityManager
            .createQueryBuilder(TransactionEntity, "t")
            .select("count(*)::int", "total")
            .addSelect("coalesce(sum(t.amountVnd), 0)::bigint", "amount")
            .where(
                "t.workspaceId = :workspaceId AND t.direction = 'credit' AND t.occurredAt >= :from AND t.occurredAt < :to",
                { workspaceId, from, to },
            )
            .getRawOne<{ total: number; amount: string | number }>()
        return { total: row?.total ?? 0, amount: Number(row?.amount ?? 0) }
    }

    /** The credits of the period, the earliest first. */
    async creditLedger(workspaceId: string, from: Date, to: Date, limit: number): Promise<Array<LedgerPayment>> {
        const rows = await this.entityManager
            .createQueryBuilder(TransactionEntity, "t")
            .where(
                "t.workspaceId = :workspaceId AND t.direction = 'credit' AND t.occurredAt >= :from AND t.occurredAt < :to",
                { workspaceId, from, to },
            )
            .orderBy("t.occurredAt")
            .limit(limit)
            .getMany()
        return rows.map((row) => ({
            occurredAt: row.occurredAt,
            amountVnd: row.amountVnd,
            reference: row.reference,
            payer: row.payer,
            channel: row.channel,
            status: row.status,
        }))
    }

    /** The payment a receipt is for, or null when the workspace has none with that id. */
    async receiptPayment(workspaceId: string, transactionId: string): Promise<ReceiptPayment | null> {
        const row = await this.entityManager.findOne(TransactionEntity, { where: { workspaceId, id: transactionId } })
        return row === null ? null : { invoiceId: row.invoiceId, amountVnd: row.amountVnd, occurredAt: row.occurredAt }
    }
}
