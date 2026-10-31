import { Injectable } from "@nestjs/common"
import { AccountingAdjustmentsService } from "@modules/domain/accounting-adjustments"
import { EvidenceService } from "@modules/domain/decisions"
import { InvoicesService } from "@modules/domain/invoices"
import { OrdersService } from "@modules/domain/orders"
import { SupplierPayablesService } from "@modules/domain/supplier-payables"
import { TransactionsService } from "@modules/domain/transactions"
import { WorkItemsService } from "@modules/domain/work-items"
import type { AccountingBook } from "./accounting-book.contracts"

@Injectable()
/** Composes accounting records through their existing table owners without owning foreign SQL. */
export class AccountingBookService {
    constructor(
        private readonly invoices: InvoicesService,
        private readonly transactions: TransactionsService,
        private readonly orders: OrdersService,
        private readonly workItems: WorkItemsService,
        private readonly evidence: EvidenceService,
        private readonly adjustments: AccountingAdjustmentsService,
        private readonly payables: SupplierPayablesService,
    ) {}
    /** Reads the complete bounded book for a workspace whose caller has already proved membership. */
    async read(workspaceId: string): Promise<AccountingBook> {
        const [invoices, transactions, orders, works, decisions, adjustments, open, paid] = await Promise.all([
            this.invoices.listAccounting(workspaceId),
            this.transactions.listAccounting(workspaceId),
            this.orders.list(workspaceId, 500),
            this.workItems.listAccounting(workspaceId),
            this.evidence.listAccounting(workspaceId),
            this.adjustments.history(workspaceId),
            this.payables.listOpen(workspaceId),
            this.payables.listPaid(workspaceId),
        ])
        return {
            invoices,
            transactions,
            orders: orders.slice(0, 500).map((order) => ({
                ...order,
                lead: order.lead_id === null ? null : { contact_name: order.contact_name, company: order.company },
            })),
            works,
            decisions,
            adjustments: adjustments.items,
            payables: [...open, ...paid],
            adjustmentsReady: adjustments.ready,
        }
    }
}
