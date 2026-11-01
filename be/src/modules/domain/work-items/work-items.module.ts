import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./work-items.module-definition"
import { WORK_ITEMS_LEADS } from "./work-items.decorators"
import { WorkItemsService } from "./work-items.service"
import { WorkItemsActivityService } from "./work-items-activity.service"
import { WorkItemsReplyProgressService } from "./work-items-reply-progress.service"
import { WorkItemsReadService } from "./work-items-read.service"
import { WorkItemsChainReadService } from "./work-items-chain-read.service"
import { WorkItemsLeadReadService } from "./work-items-lead-read.service"
import { WorkItemsViewsReadService } from "./work-items-views-read.service"
import { WorkItemsDecisionsReadService } from "./work-items-decisions-read.service"

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
                { provide: WORK_ITEMS_LEADS, useExisting: options.ports.leads },
                WorkItemsService,
                WorkItemsReadService,
                WorkItemsActivityService,
                WorkItemsReplyProgressService,
                WorkItemsDecisionsReadService,
                WorkItemsViewsReadService,
                WorkItemsLeadReadService,
                WorkItemsChainReadService,
            ],
            exports: [
                WorkItemsService,
                WorkItemsReadService,
                WorkItemsActivityService,
                WorkItemsReplyProgressService,
                WorkItemsDecisionsReadService,
                WorkItemsViewsReadService,
                WorkItemsLeadReadService,
                WorkItemsChainReadService,
            ],
        }
    }
}
