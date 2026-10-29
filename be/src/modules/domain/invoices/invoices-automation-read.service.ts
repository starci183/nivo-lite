import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AutomationDebtInvoice } from "./invoices-automation-read.contracts"
import { InvoiceEntity } from "./persistence/entities"

/** The most overdue invoices one scan reads. */
const DEBT_LIMIT = 50

@Injectable()
/** The invoice reads the automations make: the overdue invoices of the debt reminder and the money in of the day report. */
export class InvoicesAutomationReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The issued invoices due before an instant, oldest first; bounded. */
    debtInvoices(workspaceId: string, cutoff: string): Promise<Array<AutomationDebtInvoice>> {
        return this.entityManager
            .createQueryBuilder(InvoiceEntity, "i")
            .select([
                "i.id AS id",
                "i.invoice_no AS invoice_no",
                "i.amount_vnd AS amount_vnd",
                "i.lead_id AS lead_id",
                "i.due_at AS due_at",
            ])
            .where(
                "i.workspace_id = :workspaceId AND i.status = 'issued' AND i.due_at IS NOT NULL AND i.due_at < :cutoff",
                { workspaceId, cutoff },
            )
            .orderBy("i.due_at", "ASC")
            .limit(DEBT_LIMIT)
            .getRawMany<AutomationDebtInvoice>()
    }

    /** The money paid from an instant on (a bigint the driver answers as text, read as a number), read through the transaction of the caller. */
    async paidTotalSince(workspaceId: string, start: string, manager: EntityManager): Promise<number> {
        const row = await manager
            .createQueryBuilder(InvoiceEntity, "i")
            .select("coalesce(sum(i.amount_vnd), 0)::bigint", "total")
            .where("i.workspace_id = :workspaceId AND i.status = 'paid' AND i.paid_at >= :start", {
                workspaceId,
                start,
            })
            .getRawOne<{ total: string | number }>()
        return Number(row?.total ?? 0)
    }
}
