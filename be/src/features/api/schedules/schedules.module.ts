import { Module } from "@nestjs/common"
import { ReadScheduledItemsHandler } from "./application/read-scheduled-items.handler"
import { RunScheduledItemNowHandler } from "./application/run-scheduled-item-now.handler"
import { ConfigurableModuleClass } from "./schedules.module-definition"

@Module({ providers: [ReadScheduledItemsHandler, RunScheduledItemNowHandler] })
/** The schedules feature: what the agents of a workspace have scheduled, and "run now" for one item (the schedule list with "run now"). */
export class SchedulesApiModule extends ConfigurableModuleClass {}
