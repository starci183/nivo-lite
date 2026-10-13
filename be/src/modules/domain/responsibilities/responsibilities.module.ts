import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AGENT_DIRECTORY } from "@modules/domain/messages"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./responsibilities.module-definition"
import { ResponsibilitiesService } from "./responsibilities.service"
import { ResponsibilityJournalService } from "./responsibility-journal.service"

@Module({})
/** What somebody owes a customer: the steps of a lead journey and the journal the work engine keeps. The agent directory is bound by the app root. */
export class ResponsibilitiesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: AGENT_DIRECTORY, useExisting: options.agentDirectory },
                ResponsibilitiesService,
                ResponsibilityJournalService,
            ],
            exports: [ResponsibilitiesService, ResponsibilityJournalService],
        }
    }
}
