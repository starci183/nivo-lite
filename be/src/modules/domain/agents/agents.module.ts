import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { OFFICE_ROOMS_AGENTS } from "@modules/domain/office-rooms"
import { AgentsQueueModule } from "@modules/queues/agents"
import { AgentBundleService } from "./agent-bundle.service"
import { AgentDirectoryModule } from "./agent-directory.module"
import { AgentDirectoryService } from "./agent-directory.service"
import { AgentIdentityService } from "./agent-identity.service"
import { AgentLensesService } from "./agent-lenses.service"
import { AgentOwnershipService } from "./agent-ownership.service"
import {
    AGENTS_CONNECTIONS,
    AGENTS_INSTALLATIONS,
    AGENTS_KNOWLEDGE,
    AGENTS_MODULES,
    AGENTS_OPTIONS,
    AGENTS_WORK,
} from "./agents.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agents.module-definition"
import { AgentsService } from "./agents.service"
import { EngineStatusService } from "./engine-status.service"
import { PauseClient } from "./pause.client"

@Module({})
/** The agents of a workspace: the instance list, the dashboard, the OpenClaw bundle of each agent and the engine status. */
export class AgentsModule extends ConfigurableModuleClass {
    /**
     * Registers the capability once; the other lanes' ports are bound to the classes the options name. The setup mode registers
     * fewer real providers (no knowledge lens, no engine status) and nothing in their place; the directory mode registers only the
     * agent directory.
     */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if ("directoryOnly" in options) {
            return {
                ...base,
                imports: [...(base.imports ?? []), AgentDirectoryModule.register({})],
                exports: [AgentDirectoryModule],
            }
        }
        const { isGlobal: _isGlobal, ...parsed } = options
        const shared = [
            { provide: AGENTS_OPTIONS, useValue: parsed },
            { provide: AGENTS_INSTALLATIONS, useClass: options.ports.installations },
            { provide: AGENTS_MODULES, useClass: options.ports.modules },
            { provide: AGENTS_CONNECTIONS, useExisting: options.ports.connections },
            { provide: AGENTS_WORK, useExisting: options.ports.work },
            PauseClient,
            AgentsService,
            { provide: OFFICE_ROOMS_AGENTS, useExisting: AgentDirectoryService },
            AgentIdentityService,
            AgentBundleService,
            AgentOwnershipService,
        ]
        const exported = [
            AgentsQueueModule,
            AGENTS_INSTALLATIONS,
            PauseClient,
            AgentsService,
            AgentDirectoryModule,
            OFFICE_ROOMS_AGENTS,
            AgentIdentityService,
            AgentBundleService,
            AgentOwnershipService,
        ]
        const full =
            options.setupOnly === true
                ? { providers: [], exports: [] }
                : {
                      providers: [
                          { provide: AGENTS_KNOWLEDGE, useClass: options.ports.knowledge },
                          EngineStatusService,
                          AgentLensesService,
                      ],
                      exports: [AGENTS_KNOWLEDGE, EngineStatusService, AgentLensesService],
                  }
        return {
            ...base,
            imports: [...(base.imports ?? []), AgentsQueueModule.register({}), AgentDirectoryModule.register({})],
            providers: [...(base.providers ?? []), ...shared, ...full.providers],
            exports: [...exported, ...full.exports],
        }
    }
}
