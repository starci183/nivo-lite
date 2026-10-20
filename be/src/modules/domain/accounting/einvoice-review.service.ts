import { Injectable } from "@nestjs/common"
import { eachInOrder } from "@modules/platform/primitives"
import type { ReviewTally, SupplierOnFile, TaxProfile } from "./accounting-desk.contracts"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway } from "./accounting-gateway.port"
import { AccountingRoomService } from "./accounting-room.service"
import { checkEinvoice, exceptionCard, exceptionText, supplierOf } from "./einvoice-checks.policy"

@Injectable()
/**
 * N16: reads the e-invoices received since a moment through the gateway (`einvoice.list`; the gateway's einvoice adapter reads the
 * inbox and parses TT78 XML or PDF), checks tax codes and amounts, and raises anything that is not valid in the accounting room.
 */
export class EinvoiceReviewService {
    constructor(
        @InjectAccountingGateway() private readonly gateway: AccountingGateway,
        private readonly room: AccountingRoomService,
    ) {}

    /** Reviews the invoices received since `since` and answers the verdicts. */
    async review(
        workspaceId: string,
        profile: TaxProfile,
        suppliers: ReadonlyArray<SupplierOnFile>,
        since: Date,
    ): Promise<ReviewTally> {
        const received = await this.gateway.listEinvoices(workspaceId, since.toISOString())
        const tally = { valid: 0, needsReview: 0, invalidTaxCode: 0 }
        await eachInOrder(received, async ({ draft }) => {
            const verdict = checkEinvoice(draft, profile.taxCode, suppliers)
            if (verdict.status === "valid") {
                tally.valid += 1
                return
            }
            if (verdict.status === "invalid_tax_code") tally.invalidTaxCode += 1
            else tally.needsReview += 1
            const supplier = supplierOf(draft, suppliers)
            await this.room.postCard(
                workspaceId,
                exceptionCard(draft, verdict, supplier),
                exceptionText(draft, verdict, supplier),
            )
        })
        return tally
    }
}
