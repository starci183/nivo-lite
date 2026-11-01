import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-connections.module-definition"
import { AgentBindingsService } from "./agent-bindings.service"
import { BINDING_AGENTS } from "./agent-connections.decorators"

@Module({})
/** Which agent listens and speaks on which connection, over the primary PostgreSQL connection. */
export class AgentConnectionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: BINDING_AGENTS, useExisting: options.ports.agents },
                AgentBindingsService,
            ],
            exports: [AgentBindingsService],
        }
    }
}
