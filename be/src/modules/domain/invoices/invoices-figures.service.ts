import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { InvoiceFigure } from "./invoices-figures.contracts"
import { InvoiceEntity } from "./persistence/entities"

/** The most invoices one figure reads. */
const FIGURES_MAX = 5000

@Injectable()
/** The dashboard lists of a workspace's invoices, always scoped to the workspace. */
export class InvoicesFiguresService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The invoices that count for the governance figures: issued or paid. */
    async issuedOrPaid(workspaceId: string): Promise<Array<InvoiceFigure>> {
        const invoices = await this.entityManager.find(InvoiceEntity, {
            select: { id: true, orderId: true, leadId: true, invoiceNo: true, amountVnd: true, status: true },
            where: { workspaceId, status: In(["issued", "paid"]) },
            take: FIGURES_MAX,
        })
        return invoices.map((invoice) => ({
            id: invoice.id,
            orderId: invoice.orderId,
            leadId: invoice.leadId,
            invoiceNo: invoice.invoiceNo,
            amountVnd: invoice.amountVnd,
            status: invoice.status,
        }))
    }
}
