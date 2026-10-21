import { Injectable } from "@nestjs/common"
import { eachInOrder } from "@modules/platform/primitives"
import type { ReviewTally, SupplierOnFile, TaxProfile } from "./accounting-desk.contracts"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway } from "./accounting-gateway.port"
import { AccountingDecisionsService } from "./accounting-decisions.service"
import { AccountingRoomService } from "./accounting-room.service"
import { checkEinvoice, exceptionCard, exceptionText, supplierOf } from "./einvoice-checks.policy"

@Injectable()
/**
 * N16: reads the e-invoices received since a moment through the workspace's `invoice.list` tool, checks tax codes and amounts, and
 * raises anything that is not valid in the accounting room as a decision for the chief accountant (an exception card with its
 * approve and decline buttons), citing the tool that read it.
 */
export class EinvoiceReviewService {
    constructor(
        @InjectAccountingGateway() private readonly gateway: AccountingGateway,
        private readonly room: AccountingRoomService,
        private readonly decisions: AccountingDecisionsService,
    ) {}

    /** Reviews the invoices received since `since` and answers the verdicts and the tool that read them. */
    async review(
        workspaceId: string,
        profile: TaxProfile,
        suppliers: ReadonlyArray<SupplierOnFile>,
        since: Date,
    ): Promise<ReviewTally> {
        const received = await this.gateway.listEinvoices(workspaceId, since.toISOString())
        const tally = { valid: 0, needsReview: 0, invalidTaxCode: 0 }
        await eachInOrder(received.value, async ({ ref, draft }) => {
            const verdict = checkEinvoice(draft, profile.taxCode, suppliers)
            if (verdict.status === "valid") {
                tally.valid += 1
                return
            }
            if (verdict.status === "invalid_tax_code") tally.invalidTaxCode += 1
            else tally.needsReview += 1
            const supplier = supplierOf(draft, suppliers)
            const text = exceptionText(draft, verdict, supplier)
            const decision = await this.decisions.askInvoiceReview(workspaceId, { ref, summary: text })
            await this.room.postCard(
                workspaceId,
                exceptionCard(draft, verdict, supplier, received.tool, decision),
                text,
            )
        })
        return { ...tally, tool: received.tool }
    }
}
