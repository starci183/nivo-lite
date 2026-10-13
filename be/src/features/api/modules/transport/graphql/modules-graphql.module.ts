import { Module } from "@nestjs/common"
import { ModulesApiModule } from "../../modules.module"
import { ModuleDefinitionResolver } from "./module-definition.resolver"
import { ModulesCatalogResolver } from "./modules-catalog.resolver"

@Module({
    imports: [ModulesApiModule],
    providers: [ModulesCatalogResolver, ModuleDefinitionResolver],
})
/** The GraphQL transport of the modules feature. */
export class ModulesGraphqlModule {}
