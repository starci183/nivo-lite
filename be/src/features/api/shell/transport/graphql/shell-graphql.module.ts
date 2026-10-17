import { Module } from "@nestjs/common"
import { ShellApiModule } from "../../shell.module"
import { ConfigurableModuleClass } from "./shell-graphql.module-definition"
import { WorkspaceShellResolver } from "./workspace-shell.resolver"

@Module({
    imports: [ShellApiModule.register({})],
    providers: [WorkspaceShellResolver],
})
/** The GraphQL transport of the shell feature. */
export class ShellGraphqlModule extends ConfigurableModuleClass {}
