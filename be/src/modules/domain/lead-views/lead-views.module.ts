import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LeadBoardService } from "./lead-board.service"
import { LeadFlowService } from "./lead-flow.service"
import { LeadJourneyService } from "./lead-journey.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lead-views.module-definition"

@Module({})
/** The authorized lead views composed through each record's owner. */
export class LeadViewsModule extends ConfigurableModuleClass {
    /** Registers the lead views once in the app root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), LeadBoardService, LeadFlowService, LeadJourneyService],
            exports: [LeadBoardService, LeadFlowService, LeadJourneyService],
        }
    }
}
