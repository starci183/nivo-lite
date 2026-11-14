import { Module, type DynamicModule } from "@nestjs/common"
import { AgentTagEffectService } from "./agent-tag-effect.service"
import { WorkflowCallReachService } from "./workflow-call-reach.service"
import { AgentsQueueModule } from "@modules/queues/agents"
import { AgentDirectoryModule } from "./agent-directory.module"
import { AgentCreationService } from "./agent-creation.service"
import { AgentIdentityService } from "./agent-identity.service"
import { AgentCatalogService } from "./agent-catalog.service"
import { AgentLensesService } from "./agent-lenses.service"
import { AgentOwnershipService } from "./agent-ownership.service"
import {
    AGENTS_CONNECTIONS,
    AGENTS_ROOMS,
    AGENTS_INSTALLATIONS,
    AGENTS_KNOWLEDGE,
    AGENTS_OPTIONS,
    AGENTS_WORK,
    AGENTS_CHANNEL_OWNERS,
} from "./agents.decorators"
import { noWorkLines } from "./agent-work.policy"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agents.module-definition"
import { AgentsService } from "./agents.service"
import { PauseClient } from "./pause.client"

@Module({})
/** The agents of a workspace: the instance list, the dashboard, the identity and the ownership of each agent. */
export class AgentsModule extends ConfigurableModuleClass {
    /**
     * Registers the capability once; the other lanes' ports are bound to the classes the options name. The setup mode registers
     * fewer real providers (no knowledge lens, no dashboard work lists) and nothing in their place; the directory mode registers only the
     * agent directory.
     */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.directoryOnly === true) {
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
            { provide: AGENTS_CONNECTIONS, useExisting: options.ports.connections },
            { provide: AGENTS_ROOMS, useExisting: options.ports.rooms },
            PauseClient,
            AgentsService,
            AgentCreationService,
            AgentIdentityService,
            AgentOwnershipService,
        ]
        const exported = [
            AgentsQueueModule,
            AGENTS_INSTALLATIONS,
            PauseClient,
            AgentsService,
            AgentDirectoryModule,
            AgentIdentityService,
            AgentOwnershipService,
        ]
        const full =
            options.setupOnly === true
                ? { providers: [{ provide: AGENTS_WORK, useValue: { dashboardList: noWorkLines } }], exports: [] }
                : {
                      providers: [
                          { provide: AGENTS_WORK, useExisting: options.ports.work },
                          { provide: AGENTS_CHANNEL_OWNERS, useExisting: options.ports.channelOwners },
                          { provide: AGENTS_KNOWLEDGE, useClass: options.ports.knowledge },
                          AgentCatalogService,
                          AgentLensesService,
                          WorkflowCallReachService,
                          AgentTagEffectService,
                      ],
                      exports: [AGENTS_KNOWLEDGE, AgentCatalogService, AgentLensesService, WorkflowCallReachService],
                  }
        return {
            ...base,
            imports: [...(base.imports ?? []), AgentsQueueModule.register({}), AgentDirectoryModule.register({})],
            providers: [...(base.providers ?? []), ...shared, ...full.providers],
            exports: [...exported, ...full.exports],
        }
    }
}
