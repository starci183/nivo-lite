import { Query } from "@nestjs/cqrs"
import type { QuotaLookup } from "@modules/domain/ai-usage-events"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetCreditQuotaStatusRequest } from "./get-credit-quota-status.contracts"

/** Asks for get credit quota status. */
export class GetCreditQuotaStatusQuery extends Query<QuotaLookup> {
    constructor(readonly params: ExecuteParams<GetCreditQuotaStatusRequest>) {
        super()
    }
}
