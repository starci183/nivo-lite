import { Module } from "@nestjs/common"
import { ModulesApiModule } from "../../modules.module"
import { GetCatalogController } from "./get-catalog.controller"
import { GetModuleController } from "./get-module.controller"

@Module({ imports: [ModulesApiModule], controllers: [GetCatalogController, GetModuleController] })
/** The HTTP transport of the modules feature. */
export class ModulesHttpModule {}
