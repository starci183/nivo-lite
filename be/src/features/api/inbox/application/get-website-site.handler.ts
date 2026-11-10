import { QueryHandler } from "@nestjs/cqrs"
import { WebsiteSitesService } from "@modules/domain/inbox-leads"
import type { WebsiteSiteView } from "@modules/domain/inbox-leads"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetWebsiteSiteQuery } from "./get-website-site.query"

@QueryHandler(GetWebsiteSiteQuery)
/** Reads the website intake through the website sites service, which proves membership. */
export class GetWebsiteSiteHandler extends ICQRSHandler<GetWebsiteSiteQuery, WebsiteSiteView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sites: WebsiteSitesService,
    ) {
        super(logger)
    }

    protected override process(query: GetWebsiteSiteQuery): Promise<WebsiteSiteView> {
        return this.sites.view(query.params.principal.id, query.params.request.workspaceId)
    }
}
