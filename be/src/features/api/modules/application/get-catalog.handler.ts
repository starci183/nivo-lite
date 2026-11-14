import { QueryHandler } from "@nestjs/cqrs"
import { ModuleAccessService, type OpenCatalog } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetCatalogQuery } from "./get-catalog.query"

@QueryHandler(GetCatalogQuery)
/** Answers the catalogue of installable agents as the named workspace may see it: one list, the modules of every installed plugin. */
export class GetCatalogHandler extends ICQRSHandler<GetCatalogQuery, OpenCatalog> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly access: ModuleAccessService,
    ) {
        super(logger)
    }

    protected override process(query: GetCatalogQuery): Promise<OpenCatalog> {
        return this.access.catalogFor(query.params.principal.id, query.params.request.workspaceId)
    }
}
