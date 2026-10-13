import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AutomationCommandsService } from "./automation-commands.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./automation-commands.module-definition"

@Module({})
/** The commands a manager's screen queues for the back end: the wording of a template proposed, a scheduled workflow run now. */
export class AutomationCommandsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AutomationCommandsService],
            exports: [AutomationCommandsService],
        }
    }
}
