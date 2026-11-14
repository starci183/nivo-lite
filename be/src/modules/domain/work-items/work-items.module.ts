import { WorkInHandService } from "./work-in-hand.service"
import { WorkItemsDashboardReadService } from "./work-items-dashboard-read.service"
import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./work-items.module-definition"
import { WorkItemsService } from "./work-items.service"
import { WorkItemsActivityService } from "./work-items-activity.service"
import { WorkItemsViewsReadService } from "./work-items-views-read.service"

@Module({})
/** The work items of a workspace over the primary PostgreSQL connection. */
export class WorkItemsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                WorkItemsService,
                WorkItemsActivityService,
                WorkItemsViewsReadService,
                WorkInHandService,
                WorkItemsDashboardReadService,
            ],
            exports: [
                WorkItemsService,
                WorkItemsActivityService,
                WorkItemsViewsReadService,
                WorkInHandService,
                WorkItemsDashboardReadService,
            ],
        }
    }
}
