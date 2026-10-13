import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./brain-commands.module-definition"
import { BrainCommandsService } from "./brain-commands.service"

@Module({})
/** The commands the Second Brain and Knowledge pages ask the back end to carry out, and how each ended. */
export class BrainCommandsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), BrainCommandsService],
            exports: [BrainCommandsService],
        }
    }
}
