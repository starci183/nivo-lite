import { Module } from "@nestjs/common"
import type { DynamicModule, Provider } from "@nestjs/common"
import { AgentAssignmentsService } from "./agent-assignments.service"
import { AGENT_PROFILE_THREADS } from "./agent-profile.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-profile.module-definition"
import { AgentProfileService } from "./agent-profile.service"

@Module({})
/** The agent profile page and the assignment of work to an agent; it composes the agents capability. */
export class AgentProfileModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; the work threads port is bound to the class the options name, else to nothing. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const threads: Provider =
            options.threads === undefined
                ? { provide: AGENT_PROFILE_THREADS, useValue: null }
                : { provide: AGENT_PROFILE_THREADS, useClass: options.threads }
        return {
            ...base,
            providers: [...(base.providers ?? []), threads, AgentProfileService, AgentAssignmentsService],
            exports: [AgentProfileService, AgentAssignmentsService],
        }
    }
}
