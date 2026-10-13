import { Module } from "@nestjs/common"
import { SalesWorkbenchApiModule } from "../../sales-workbench.module"
import { SalesWorkbenchResolver } from "./sales-workbench.resolver"

@Module({ imports: [SalesWorkbenchApiModule], providers: [SalesWorkbenchResolver] })
/** The GraphQL transport of the Sales workbench feature. */
export class SalesWorkbenchGraphqlModule {}
