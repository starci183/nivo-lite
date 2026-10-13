import { QueryHandler } from "@nestjs/cqrs"
import { CreditsService } from "@modules/domain/credits"
import type { CreditTopupLot } from "@modules/domain/credits"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListCreditTopupLotsQuery } from "./list-credit-topup-lots.query"

@QueryHandler(ListCreditTopupLotsQuery)
/** Answers list credit topup lots through the existing domain capability. */
export class ListCreditTopupLotsHandler extends ICQRSHandler<ListCreditTopupLotsQuery, ReadonlyArray<CreditTopupLot>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly credits: CreditsService,
    ) {
        super(logger)
    }

    protected override process(query: ListCreditTopupLotsQuery): Promise<ReadonlyArray<CreditTopupLot>> {
        return this.credits.topupLots(query.params.principal.id, query.params.request.workspaceId)
    }
}
