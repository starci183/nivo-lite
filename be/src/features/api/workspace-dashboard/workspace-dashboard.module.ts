import { Module } from "@nestjs/common"
import { GetWorkspaceDashboardHandler } from "./application/get-workspace-dashboard.handler"
import { ConfigurableModuleClass } from "./workspace-dashboard.module-definition"

@Module({ providers: [GetWorkspaceDashboardHandler] })
/** The workspace dashboard application query. */
export class WorkspaceDashboardApiModule extends ConfigurableModuleClass {}
