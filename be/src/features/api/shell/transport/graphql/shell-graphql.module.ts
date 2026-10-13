import { Module } from "@nestjs/common"
import { ShellApiModule } from "../../shell.module"
import { WorkspaceShellResolver } from "./workspace-shell.resolver"

@Module({
    imports: [ShellApiModule],
    providers: [WorkspaceShellResolver],
})
/** The GraphQL transport of the shell feature. */
export class ShellGraphqlModule {}
