import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-directory.module-definition"
import { AgentDirectoryService } from "./agent-directory.service"

@Module({})
/** The agent lookups other capabilities read through, registrable on its own by an app that composes no agent lifecycle. */
export class AgentDirectoryModule extends ConfigurableModuleClass {
    /** Registers the directory once in an app root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AgentDirectoryService],
            exports: [AgentDirectoryService],
        }
    }
}
