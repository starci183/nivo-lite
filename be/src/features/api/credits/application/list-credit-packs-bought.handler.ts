import { QueryHandler } from "@nestjs/cqrs"
import { CreditsService } from "@modules/domain/credits"
import type { CreditPackPurchase } from "@modules/domain/credits"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListCreditPacksBoughtQuery } from "./list-credit-packs-bought.query"

@QueryHandler(ListCreditPacksBoughtQuery)
/** Answers the add-on packs bought this month through the credits capability. */
export class ListCreditPacksBoughtHandler extends ICQRSHandler<
    ListCreditPacksBoughtQuery,
    ReadonlyArray<CreditPackPurchase>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly credits: CreditsService,
    ) {
        super(logger)
    }

    protected override process(query: ListCreditPacksBoughtQuery): Promise<ReadonlyArray<CreditPackPurchase>> {
        return this.credits.packsBought(query.params.principal.id, query.params.request.workspaceId)
    }
}
