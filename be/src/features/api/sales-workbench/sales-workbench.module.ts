import { Module } from "@nestjs/common"
import { ReadSalesWorkbenchHandler } from "./application/read-sales-workbench.handler"

@Module({ providers: [ReadSalesWorkbenchHandler] })
/** The application query of the Sales workbench feature. */
export class SalesWorkbenchApiModule {}
