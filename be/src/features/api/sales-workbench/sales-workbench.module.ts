import { Module } from "@nestjs/common"
import { ReadSalesWorkbenchHandler } from "./application/read-sales-workbench.handler"
import { ConfigurableModuleClass } from "./sales-workbench.module-definition"

@Module({ providers: [ReadSalesWorkbenchHandler] })
/** The application query of the Sales workbench feature. */
export class SalesWorkbenchApiModule extends ConfigurableModuleClass {}
