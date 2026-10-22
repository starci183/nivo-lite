import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentAssignmentsService } from "./agent-assignments.service"
import { AGENT_PROFILE_THREADS } from "./agent-profile.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-profile.module-definition"
import { AgentProfileService } from "./agent-profile.service"

@Module({})
/** The agent profile page and the assignment of work to an agent; it composes the agents capability. */
export class AgentProfileModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; the work threads port is bound to the class the options name. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: AGENT_PROFILE_THREADS, useExisting: options.threads },
                AgentProfileService,
                AgentAssignmentsService,
            ],
            exports: [AgentProfileService, AgentAssignmentsService],
        }
    }
}
