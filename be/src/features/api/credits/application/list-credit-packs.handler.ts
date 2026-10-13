import { QueryHandler } from "@nestjs/cqrs"
import { CreditsService } from "@modules/domain/credits"
import type { CreditPack } from "@modules/domain/credits"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListCreditPacksQuery } from "./list-credit-packs.query"

@QueryHandler(ListCreditPacksQuery)
/** Answers list credit packs through the existing domain capability. */
export class ListCreditPacksHandler extends ICQRSHandler<ListCreditPacksQuery, ReadonlyArray<CreditPack>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly credits: CreditsService,
    ) {
        super(logger)
    }

    protected override process(_query: ListCreditPacksQuery): Promise<ReadonlyArray<CreditPack>> {
        return this.credits.listPacks()
    }
}
