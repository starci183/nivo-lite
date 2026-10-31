import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isStale, supplierPayableKey } from "./supplier-payable.policy"
import type { NewSupplierPayable, SupplierPayableRow, SupplierPaymentMark } from "./supplier-payables.contracts"
import { SupplierPayableEntity } from "./persistence/entities"

/** How many paid invoices a read answers. */
const PAID_LIMIT = 200
/** The most rows one read of open invoices, or of the listed invoices, answers. */
const ROWS_MAX = 500

const toRow = (entity: SupplierPayableEntity): SupplierPayableRow => ({
    id: entity.id,
    supplier: entity.supplier,
    sellerTaxCode: entity.sellerTaxCode,
    invoiceNo: entity.invoiceNo,
    amountVnd: Number(entity.amountVnd),
    issuedOn: entity.issuedOn,
    dueOn: entity.dueOn,
    status: entity.status,
    debitRef: entity.debitRef,
    paidAt: entity.paidAt === null ? null : entity.paidAt.toISOString(),
    workItemId: entity.workItemId,
    firstSeenAt: entity.firstSeenAt.toISOString(),
    decidedBy: entity.decidedBy,
})

@Injectable()
/** The only owner of public.supplier_payables: the supplier invoices the accounting desk has seen, open or paid. */
export class SupplierPayablesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * Keeps every listed invoice as a row: a new one is inserted open, an open one that changed is rewritten, a repeat writes
     * nothing, and a paid one is never touched. Answers the rows of the listed invoices as they stand.
     */
    async record(
        workspaceId: string,
        listed: ReadonlyArray<NewSupplierPayable>,
    ): Promise<ReadonlyArray<SupplierPayableRow>> {
        if (listed.length === 0) return []
        const known = (await this.rowsOf(workspaceId, listed)).map(toRow)
        const byKey = new Map(known.map((row) => [supplierPayableKey(row), row]))
        const fresh = listed.filter((payable) => !byKey.has(supplierPayableKey(payable)))
        const changed = listed.filter((payable) => {
            const row = byKey.get(supplierPayableKey(payable))
            return row !== undefined && isStale(row, payable)
        })
        if (fresh.length > 0) {
            await this.entityManager.insert(
                SupplierPayableEntity,
                fresh.map((payable) => ({
                    workspaceId,
                    supplier: payable.supplier,
                    sellerTaxCode: payable.sellerTaxCode,
                    invoiceNo: payable.invoiceNo,
                    amountVnd: String(payable.amountVnd),
                    issuedOn: payable.issuedOn,
                    dueOn: payable.dueOn,
                })),
            )
        }
        await Promise.all(changed.map((payable) => this.rewrite(workspaceId, payable)))
        if (fresh.length === 0 && changed.length === 0) return known
        return (await this.rowsOf(workspaceId, listed)).map(toRow)
    }

    /** The invoices still to pay, soonest due first. */
    async listOpen(workspaceId: string): Promise<ReadonlyArray<SupplierPayableRow>> {
        const rows = await this.entityManager.find(SupplierPayableEntity, {
            where: { workspaceId, status: "open" },
            order: { dueOn: "ASC", invoiceNo: "ASC" },
            take: ROWS_MAX,
        })
        return rows.map(toRow)
    }

    /** The invoices an outgoing payment settled, latest first. */
    async listPaid(workspaceId: string): Promise<ReadonlyArray<SupplierPayableRow>> {
        const rows = await this.entityManager.find(SupplierPayableEntity, {
            where: { workspaceId, status: "paid" },
            order: { paidAt: "DESC", id: "DESC" },
            take: PAID_LIMIT,
        })
        return rows.map(toRow)
    }

    /** Remembers the work item that asks whether the payment settled the invoice. */
    async linkWork(workspaceId: string, id: string, workItemId: string): Promise<void> {
        await this.entityManager.update(SupplierPayableEntity, { id, workspaceId }, { workItemId })
    }

    /** Marks an open invoice paid; answers false when it was not open (a retry changes nothing). */
    async markPaid(workspaceId: string, id: string, mark: SupplierPaymentMark): Promise<boolean> {
        const result = await this.entityManager.update(
            SupplierPayableEntity,
            { id, workspaceId, status: "open" as const },
            {
                status: "paid",
                debitRef: mark.debitRef,
                paidAt: mark.paidAt,
                workItemId: mark.workItemId,
                decidedBy: mark.decidedBy,
            },
        )
        return result.affected === 1
    }

    private async rewrite(workspaceId: string, payable: NewSupplierPayable): Promise<void> {
        await this.entityManager.update(
            SupplierPayableEntity,
            {
                workspaceId,
                sellerTaxCode: payable.sellerTaxCode,
                invoiceNo: payable.invoiceNo,
                status: "open" as const,
            },
            {
                supplier: payable.supplier,
                amountVnd: String(payable.amountVnd),
                issuedOn: payable.issuedOn,
                dueOn: payable.dueOn,
            },
        )
    }

    private rowsOf(
        workspaceId: string,
        listed: ReadonlyArray<NewSupplierPayable>,
    ): Promise<Array<SupplierPayableEntity>> {
        return this.entityManager.find(SupplierPayableEntity, {
            where: listed.map((payable) => ({
                workspaceId,
                sellerTaxCode: payable.sellerTaxCode,
                invoiceNo: payable.invoiceNo,
            })),
            take: ROWS_MAX,
        })
    }
}
