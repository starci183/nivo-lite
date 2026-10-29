import { Injectable } from "@nestjs/common"
import { LessThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CashInvoice, InvoicedPeriod } from "./invoices-cash-read.contracts"
import { InvoiceEntity } from "./persistence/entities"

const CASH_COLUMNS = {
    invoiceNo: true,
    amountVnd: true,
    contractId: true,
    leadId: true,
    periodEndsOn: true,
    issuedAt: true,
    dueAt: true,
    paidAt: true,
} as const

const toCash = (row: InvoiceEntity): CashInvoice => ({
    invoiceNo: row.invoiceNo,
    amountVnd: row.amountVnd,
    contractId: row.contractId,
    leadId: row.leadId,
    periodEndsOn: row.periodEndsOn,
    issuedAt: row.issuedAt,
    dueAt: row.dueAt,
    paidAt: row.paidAt,
})

@Injectable()
/** Request-time invoice reads for the cash reports of other capabilities, always scoped to the workspace and bounded by the caller. */
export class InvoicesCashReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** What the workspace's invoices paid from an instant on add up to, in VND. */
    async paidTotalSince(workspaceId: string, since: Date): Promise<number> {
        const row = await this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .select("coalesce(sum(i.amountVnd), 0)::bigint", "total")
            .where("i.workspaceId = :workspaceId AND i.status = 'paid' AND i.paidAt >= :since", { workspaceId, since })
            .getRawOne<{ total: string | number }>()
        return Number(row?.total ?? 0)
    }

    /** The contract-bound invoices issued in the period that are not cancelled, the earliest issue first. */
    async renewalsIssued(workspaceId: string, from: Date, to: Date, limit: number): Promise<Array<CashInvoice>> {
        const rows = await this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .select(Object.keys(CASH_COLUMNS).map((column) => `i.${column}`))
            .where(
                "i.workspaceId = :workspaceId AND i.contractId IS NOT NULL AND i.status <> 'cancelled' AND i.issuedAt >= :from AND i.issuedAt < :to",
                { workspaceId, from, to },
            )
            .orderBy("i.issuedAt", "ASC")
            .addOrderBy("i.invoiceNo", "ASC")
            .limit(limit)
            .getMany()
        return rows.map(toCash)
    }

    /** The contract-bound invoices paid in the period, the earliest payment first. */
    async renewalsPaid(workspaceId: string, from: Date, to: Date, limit: number): Promise<Array<CashInvoice>> {
        const rows = await this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .select(Object.keys(CASH_COLUMNS).map((column) => `i.${column}`))
            .where(
                "i.workspaceId = :workspaceId AND i.contractId IS NOT NULL AND i.status = 'paid' AND i.paidAt >= :from AND i.paidAt < :to",
                { workspaceId, from, to },
            )
            .orderBy("i.paidAt", "ASC")
            .addOrderBy("i.invoiceNo", "ASC")
            .limit(limit)
            .getMany()
        return rows.map(toCash)
    }

    /** The issued invoices that fall due before an instant, the earliest due date first. */
    async unpaidDueBefore(workspaceId: string, before: Date, limit: number): Promise<Array<CashInvoice>> {
        const rows = await this.entityManager.find(InvoiceEntity, {
            select: CASH_COLUMNS,
            where: { workspaceId, status: "issued", dueAt: LessThan(before) },
            order: { dueAt: "ASC", invoiceNo: "ASC" },
            take: limit,
        })
        return rows.map(toCash)
    }

    /** The periods the given contracts were already invoiced for, cancelled invoices left out. */
    async invoicedPeriods(workspaceId: string, contractIds: ReadonlyArray<string>): Promise<Array<InvoicedPeriod>> {
        if (contractIds.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .select(["i.contractId", "i.periodEndsOn"])
            .where("i.workspaceId = :workspaceId AND i.contractId IN (:...contractIds) AND i.status <> 'cancelled'", {
                workspaceId,
                contractIds: [...contractIds],
            })
            .limit(contractIds.length * 12)
            .getMany()
        return rows.flatMap((row) =>
            row.contractId === null || row.periodEndsOn === null
                ? []
                : [{ contractId: row.contractId, periodEndsOn: row.periodEndsOn }],
        )
    }
}
