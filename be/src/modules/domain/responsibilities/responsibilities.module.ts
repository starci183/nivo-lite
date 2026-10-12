import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ResponsibilityJournalService } from "./responsibility-journal.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./responsibilities.module-definition"

@Module({})
/** What somebody owes a customer. The app root provides the `AGENT_DIRECTORY` port and the events and members capabilities. */
export class ResponsibilitiesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ResponsibilityJournalService],
            exports: [ResponsibilityJournalService],
        }
    }
}
