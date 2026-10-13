import { Injectable } from "@nestjs/common"
import { BillingService } from "@modules/domain/billing"
import { SepayTransactionsService } from "./sepay-transactions.service"
import type { ReviewTransaction } from "./sepay-transactions.contracts"

@Injectable()
/** Manager-authorized reads of workspace transfers needing review. */
export class SepayReviewService {
    constructor(
        private readonly billing: BillingService,
        private readonly transactions: SepayTransactionsService,
    ) {}

    /** Reads only transfers matched to the selected manager's workspace orders. */
    async review(
        userId: string,
        workspaceId: string,
        orderIds: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<ReviewTransaction>> {
        await this.billing.requireManager(userId, workspaceId)
        return this.transactions.review(workspaceId, orderIds)
    }
}
