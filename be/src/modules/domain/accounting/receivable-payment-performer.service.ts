import { Injectable } from "@nestjs/common"
import type { Performed, Prepared, Proposal, WorkContext, WorkItem, WorkPerformer } from "@modules/domain/decisions"
import { AccountingError, AccountingErrorCode } from "./errors/accounting.error"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway } from "./accounting-gateway.port"

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

@Injectable()
/**
 * `record_receivable_payment`: once the chief accountant approves a payment the reconcile raised (a credit that does not pay its
 * receivable's balance exactly), it records that credit on the receivable through the workspace's `receivable.recordPayment` tool,
 * by capability role and keyed by the credit. A payment the connector did not record fails the item, so nothing is claimed.
 */
export class ReceivablePaymentPerformerService implements WorkPerformer {
    constructor(@InjectAccountingGateway() private readonly gateway: AccountingGateway) {}

    /** The proposal is preset by the reconcile that raised it. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Records the approved credit on its receivable. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const receivableId = textOf(proposal.fields.receivable_id)
        const creditRef = textOf(proposal.fields.credit_ref)
        const amountVnd = proposal.amount_vnd ?? null
        if (receivableId === "" || creditRef === "" || amountVnd === null) {
            throw new AccountingError({ code: AccountingErrorCode.PaymentInvalid, params: { item: item.id } })
        }
        const recorded = await this.gateway.recordPayment(ctx.workspaceId, { receivableId, creditRef, amountVnd })
        if (!recorded)
            throw new AccountingError({ code: AccountingErrorCode.PaymentNotRecorded, params: { credit: creditRef } })
        return { summary: proposal.summary, evidence: "captured", lead_id: item.lead_id, detail: creditRef }
    }
}
