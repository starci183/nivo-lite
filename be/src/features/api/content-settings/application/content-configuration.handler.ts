import { QueryHandler } from "@nestjs/cqrs"
import { ContentConfigurationService, type ContentConfiguration } from "@modules/domain/content-settings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ContentConfigurationQuery } from "./content-configuration.query"

@QueryHandler(ContentConfigurationQuery)
/** Delegates contentConfiguration to the workspace configuration capability. */
export class ContentConfigurationHandler extends ICQRSHandler<ContentConfigurationQuery, ContentConfiguration> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly configuration: ContentConfigurationService,
    ) {
        super(logger)
    }

    protected override process(query: ContentConfigurationQuery): Promise<ContentConfiguration> {
        return this.configuration.readConfiguration(query.params.principal.id, query.params.request.workspaceId)
    }
}
