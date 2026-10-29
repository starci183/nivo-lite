import { Injectable } from "@nestjs/common"
import { LessThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { InvoiceTally, LedgerInvoice, OverdueInvoice, ReceiptInvoice } from "./invoices-ledger.contracts"
import { InvoiceEntity } from "./persistence/entities"

@Injectable()
/** The invoice figures and ledger lines the n8n workflows and other report readers ask for, always bounded by the caller. */
export class InvoicesLedgerService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** How many invoices were issued in the period and what they add up to. */
    async issuedTally(workspaceId: string, from: Date, to: Date): Promise<InvoiceTally> {
        return this.tally(
            "i.workspaceId = :workspaceId AND i.status = 'issued' AND i.issuedAt >= :from AND i.issuedAt < :to",
            { workspaceId, from, to },
        )
    }

    /** How many issued invoices were due before the instant and what they add up to. */
    async overdueTally(workspaceId: string, before: Date): Promise<InvoiceTally> {
        return this.tally("i.workspaceId = :workspaceId AND i.status = 'issued' AND i.dueAt < :before", {
            workspaceId,
            before,
        })
    }

    /** The issued invoices that fell due before the cutoff, the oldest due date first. */
    async overdueBefore(workspaceId: string, cutoff: Date, limit: number): Promise<Array<OverdueInvoice>> {
        const rows = await this.entityManager.find(InvoiceEntity, {
            select: { id: true, invoiceNo: true, amountVnd: true, dueAt: true, leadId: true },
            where: { workspaceId, status: "issued", dueAt: LessThan(cutoff) },
            order: { dueAt: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({
            id: row.id,
            invoiceNo: row.invoiceNo,
            amountVnd: row.amountVnd,
            dueAt: row.dueAt,
            leadId: row.leadId,
        }))
    }

    /** The invoices issued in the period that are not drafts, the earliest issue first. */
    async issuedLedger(workspaceId: string, from: Date, to: Date, limit: number): Promise<Array<LedgerInvoice>> {
        const rows = await this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .where(
                "i.workspaceId = :workspaceId AND i.status <> 'draft' AND i.issuedAt >= :from AND i.issuedAt < :to",
                {
                    workspaceId,
                    from,
                    to,
                },
            )
            .orderBy("i.issuedAt")
            .limit(limit)
            .getMany()
        return rows.map((row) => ({
            invoiceNo: row.invoiceNo,
            amountVnd: row.amountVnd,
            issuedAt: row.issuedAt,
            status: row.status,
        }))
    }

    /** The invoice a receipt is for, or null when the workspace has none with that id. */
    async receiptInvoice(workspaceId: string, invoiceId: string): Promise<ReceiptInvoice | null> {
        const row = await this.entityManager.findOne(InvoiceEntity, { where: { workspaceId, id: invoiceId } })
        return row === null
            ? null
            : {
                  id: row.id,
                  invoiceNo: row.invoiceNo,
                  amountVnd: row.amountVnd,
                  leadId: row.leadId,
                  paidAt: row.paidAt,
              }
    }

    /** The count and the amount sum of the invoices that match a condition. */
    private async tally(condition: string, parameters: Record<string, string | Date>): Promise<InvoiceTally> {
        const row = await this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .select("count(*)::int", "total")
            .addSelect("coalesce(sum(i.amountVnd), 0)::bigint", "amount")
            .where(condition, parameters)
            .getRawOne<{ total: number; amount: string | number }>()
        return { total: row?.total ?? 0, amount: Number(row?.amount ?? 0) }
    }
}
