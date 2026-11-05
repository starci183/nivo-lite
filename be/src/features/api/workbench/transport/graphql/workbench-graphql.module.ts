import { Module } from "@nestjs/common"
import { WorkbenchApiModule } from "../../workbench.module"
import { ConfigurableModuleClass } from "./workbench-graphql.module-definition"
import { WorkbenchActionResolver } from "./workbench-action.resolver"
import { WorkbenchReadResolver } from "./workbench-read.resolver"

@Module({ imports: [WorkbenchApiModule.register({})], providers: [WorkbenchReadResolver, WorkbenchActionResolver] })
/** The GraphQL transport of the workbench door feature. */
export class WorkbenchGraphqlModule extends ConfigurableModuleClass {}
