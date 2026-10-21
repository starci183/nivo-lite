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
    /**
     * Registers the capability once; the other lanes' ports are bound to the classes the options name. The setup mode registers
     * fewer real providers (no knowledge lens, no engine status) and nothing in their place.
     */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { isGlobal: _isGlobal, ...parsed } = options
        const shared = [
            { provide: AGENTS_OPTIONS, useValue: parsed },
            { provide: AGENTS_INSTALLATIONS, useClass: options.ports.installations },
            { provide: AGENTS_MODULES, useClass: options.ports.modules },
            PauseClient,
            AgentsService,
            AgentBundleService,
        ]
        const exported = [AgentsQueueModule, AGENTS_INSTALLATIONS, PauseClient, AgentsService, AgentBundleService]
        const full =
            options.setupOnly === true
                ? { providers: [], exports: [] }
                : {
                      providers: [
                          { provide: AGENTS_KNOWLEDGE, useClass: options.ports.knowledge },
                          EngineStatusService,
                      ],
                      exports: [AGENTS_KNOWLEDGE, EngineStatusService],
                  }
        return {
            ...base,
            imports: [...(base.imports ?? []), AgentsQueueModule.register({})],
            providers: [...(base.providers ?? []), ...shared, ...full.providers],
            exports: [...exported, ...full.exports],
        }
    }
}
