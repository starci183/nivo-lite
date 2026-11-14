import { QueryHandler } from "@nestjs/cqrs"
import { TemplateListingsService, type ListingView } from "@modules/domain/template-marketplace"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { MyTemplateListingsQuery } from "./my-template-listings.query"

@QueryHandler(MyTemplateListingsQuery)
/** Lists the listings of the templates of the caller with their review state. */
export class MyTemplateListingsHandler extends ICQRSHandler<MyTemplateListingsQuery, ReadonlyArray<ListingView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly svc: TemplateListingsService,
    ) {
        super(logger)
    }

    protected override process(query: MyTemplateListingsQuery): Promise<ReadonlyArray<ListingView>> {
        return this.svc.mine(query.params.principal.id)
    }
}
