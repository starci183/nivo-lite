import { Module } from "@nestjs/common"
import { ReadWorkspaceThemeHandler } from "./application/read-workspace-theme.handler"
import { ResetWorkspaceThemeHandler } from "./application/reset-workspace-theme.handler"
import { UpdateWorkspaceThemeHandler } from "./application/update-workspace-theme.handler"
import { ConfigurableModuleClass } from "./workspace-theme.module-definition"

@Module({
    providers: [ReadWorkspaceThemeHandler, UpdateWorkspaceThemeHandler, ResetWorkspaceThemeHandler],
})
/** The workspace theme feature: the handlers of its application. */
export class WorkspaceThemeApiModule extends ConfigurableModuleClass {}
