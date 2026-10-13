import { QueryHandler } from "@nestjs/cqrs"
import { ModulesService } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetModuleQuery } from "./get-module.query"

@QueryHandler(GetModuleQuery)
/** Answers one module of the catalogue from the modules service. */
export class GetModuleHandler extends ICQRSHandler<GetModuleQuery, ModuleDefinition> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly modulesService: ModulesService,
    ) {
        super(logger)
    }

    protected override process(query: GetModuleQuery): Promise<ModuleDefinition> {
        return this.modulesService.find(query.params.request.key)
    }
}
