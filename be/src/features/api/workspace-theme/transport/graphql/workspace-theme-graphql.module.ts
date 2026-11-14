import { Module } from "@nestjs/common"
import { WorkspaceThemeApiModule } from "../../workspace-theme.module"
import { WorkspaceThemeResolver } from "./workspace-theme.resolver"
import { ConfigurableModuleClass } from "./workspace-theme-graphql.module-definition"

@Module({
    imports: [WorkspaceThemeApiModule.register({})],
    providers: [WorkspaceThemeResolver],
})
/** The GraphQL transport of the workspace theme feature. */
export class WorkspaceThemeGraphqlModule extends ConfigurableModuleClass {}
