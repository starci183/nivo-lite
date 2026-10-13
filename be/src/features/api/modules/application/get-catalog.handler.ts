import { QueryHandler } from "@nestjs/cqrs"
import { ModulesService } from "@modules/domain/modules"
import type { ModulesCatalog } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetCatalogQuery } from "./get-catalog.query"

@QueryHandler(GetCatalogQuery)
/** Answers the catalogue of installable agents from the modules service. */
export class GetCatalogHandler extends ICQRSHandler<GetCatalogQuery, ModulesCatalog> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly modulesService: ModulesService,
    ) {
        super(logger)
    }

    protected override process(): Promise<ModulesCatalog> {
        return this.modulesService.catalog()
    }
}
