import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-profile.module-definition"
import { AgentProfileService } from "./agent-profile.service"

@Module({})
/** The agent profile page; it composes the agents capability. */
export class AgentProfileModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AgentProfileService],
            exports: [AgentProfileService],
        }
    }
}
