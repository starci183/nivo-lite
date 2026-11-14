import { QueryHandler } from "@nestjs/cqrs"
import { ModuleAccessService, type CatalogModule } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetModuleQuery } from "./get-module.query"

@QueryHandler(GetModuleQuery)
/** Answers one module of the catalogue from the modules service. */
export class GetModuleHandler extends ICQRSHandler<GetModuleQuery, CatalogModule> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly access: ModuleAccessService,
    ) {
        super(logger)
    }

    protected override process(query: GetModuleQuery): Promise<CatalogModule> {
        return this.access.findFor(
            query.params.principal.id,
            query.params.request.key,
            query.params.request.workspaceId,
        )
    }
}
