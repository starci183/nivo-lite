import { Module } from "@nestjs/common"
import { GetDashboardHandler } from "./application/get-dashboard.handler"
import { ConfigurableModuleClass } from "./overview.module-definition"

@Module({ providers: [GetDashboardHandler] })
/** The overview feature: the handlers of its application. */
export class OverviewApiModule extends ConfigurableModuleClass {}
