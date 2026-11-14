import { QueryHandler } from "@nestjs/cqrs"
import { WebsiteSitesService } from "@modules/domain/inbox-leads"
import type { WorkspaceTheme } from "@modules/domain/workspace-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetWebsiteThemeQuery } from "./get-website-theme.query"

@QueryHandler(GetWebsiteThemeQuery)
/** Answers the theme parameters of the site's workspace through the website sites service, which judges the site key and the intake switch. */
export class GetWebsiteThemeHandler extends ICQRSHandler<GetWebsiteThemeQuery, WorkspaceTheme | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sites: WebsiteSitesService,
    ) {
        super(logger)
    }

    protected override process(query: GetWebsiteThemeQuery): Promise<WorkspaceTheme | null> {
        return this.sites.themeOf(query.params.request.siteKey)
    }
}
