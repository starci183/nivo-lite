import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LeadActionsQueueModule } from "@modules/queues/lead-actions"
import { LeadActionAiService } from "./lead-action-ai.service"
import { LeadActionFlowService } from "./lead-action-flow.service"
import { LeadActionsService } from "./lead-actions.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lead-actions.module-definition"

@Module({})
/** The asynchronous lead actions over the existing capture, AI and authority engine capabilities. */
export class LeadActionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), LeadActionsQueueModule],
            providers: [...(base.providers ?? []), LeadActionsService, LeadActionAiService, LeadActionFlowService],
            exports: [LeadActionsService],
        }
    }
}
