import { Module } from "@nestjs/common"
import { WorkbenchApiModule } from "../../workbench.module"
import { ConfigurableModuleClass } from "./workbench-graphql.module-definition"
import { WorkbenchActionResolver } from "./workbench-action.resolver"
import { WorkbenchFileResolver } from "./workbench-file.resolver"
import { WorkbenchReadResolver } from "./workbench-read.resolver"
import { RecordTypesResolver } from "./record-types.resolver"

@Module({
    imports: [WorkbenchApiModule.register({})],
    providers: [WorkbenchReadResolver, WorkbenchActionResolver, WorkbenchFileResolver, RecordTypesResolver],
})
/** The GraphQL transport of the workbench door feature. */
export class WorkbenchGraphqlModule extends ConfigurableModuleClass {}
