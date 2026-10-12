import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentsQueueModule } from "@modules/queues/agents"
import { AgentBundleService } from "./agent-bundle.service"
import { AGENTS_INSTALLATIONS, AGENTS_KNOWLEDGE, AGENTS_MODULES, AGENTS_OPTIONS } from "./agents.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agents.module-definition"
import { AgentsService } from "./agents.service"
import { EngineStatusService } from "./engine-status.service"
import { PauseClient } from "./pause.client"

@Module({})
/** The agents of a workspace: the instance list, the dashboard, the OpenClaw bundle of each agent and the engine status. */
export class AgentsModule extends ConfigurableModuleClass {
    /** Registers the capability once; the other lanes' ports are bound to the classes the options name. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { isGlobal: _isGlobal, ...parsed } = options
        return {
            ...base,
            imports: [...(base.imports ?? []), AgentsQueueModule],
            providers: [
                ...(base.providers ?? []),
                { provide: AGENTS_OPTIONS, useValue: parsed },
                { provide: AGENTS_INSTALLATIONS, useExisting: options.ports.installations },
                { provide: AGENTS_KNOWLEDGE, useExisting: options.ports.knowledge },
                { provide: AGENTS_MODULES, useExisting: options.ports.modules },
                PauseClient,
                AgentsService,
                AgentBundleService,
                EngineStatusService,
            ],
            exports: [
                AgentsQueueModule,
                AGENTS_INSTALLATIONS,
                AGENTS_KNOWLEDGE,
                PauseClient,
                AgentsService,
                AgentBundleService,
                EngineStatusService,
            ],
        }
    }
}
