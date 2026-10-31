import { Injectable } from "@nestjs/common"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem, WorkPerformer } from "@modules/domain/decisions"
import { SupplierPayablesService } from "@modules/domain/supplier-payables"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { AccountingError, AccountingErrorCode } from "./errors/accounting.error"

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

@Injectable()
/**
 * `confirm_supplier_payment`: once the gate passes an outgoing payment that paid a supplier invoice, or the chief accountant
 * approves one that only partly matched, the invoice row is marked paid with the payment, the time and who decided. A row that
 * is already paid stays as it is, so a retry changes nothing.
 */
export class SupplierPaymentPerformerService implements WorkPerformer {
    constructor(
        private readonly payables: SupplierPayablesService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The proposal is preset by the morning run that raised it. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Marks the invoice paid by the payment the proposal names. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const debitRef = textOf(proposal.fields.debit_ref)
        if (item.subject_id === null || debitRef === "") {
            throw new AccountingError({ code: AccountingErrorCode.PaymentInvalid, params: { item: item.id } })
        }
        await this.payables.markPaid(ctx.workspaceId, item.subject_id, {
            debitRef,
            paidAt: this.clock.now(),
            workItemId: item.id,
            decidedBy: ctx.actor,
        })
        return { summary: proposal.summary, evidence: "captured", lead_id: item.lead_id, detail: debitRef }
    }
}
