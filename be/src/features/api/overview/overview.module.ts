import { Module } from "@nestjs/common"
import { GetDashboardHandler } from "./application/get-dashboard.handler"

@Module({ providers: [GetDashboardHandler] })
/** The overview feature: the handlers of its application. */
export class OverviewApiModule {}
