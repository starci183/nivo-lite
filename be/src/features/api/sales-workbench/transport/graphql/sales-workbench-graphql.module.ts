import { Module } from "@nestjs/common"
import { SalesWorkbenchApiModule } from "../../sales-workbench.module"
import { ConfigurableModuleClass } from "./sales-workbench-graphql.module-definition"
import { SalesWorkbenchResolver } from "./sales-workbench.resolver"

@Module({ imports: [SalesWorkbenchApiModule.register({})], providers: [SalesWorkbenchResolver] })
/** The GraphQL transport of the Sales workbench feature. */
export class SalesWorkbenchGraphqlModule extends ConfigurableModuleClass {}
