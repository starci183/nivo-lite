import { Module } from "@nestjs/common"
import { GetCatalogHandler } from "./application/get-catalog.handler"
import { GetModuleHandler } from "./application/get-module.handler"

@Module({ providers: [GetCatalogHandler, GetModuleHandler] })
/** The modules feature: the handlers that read the catalogue of installable agents. */
export class ModulesApiModule {}
