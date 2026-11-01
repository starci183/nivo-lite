import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentPluginsService } from "./agent-plugins.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-plugins.module-definition"

@Module({})
/** The one door a domain registers through: its manifest fans out to the registries of the agent core when its module starts. */
export class AgentPluginsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), AgentPluginsService], exports: [AgentPluginsService] }
    }
}
