import type { DynamicModule } from "@nestjs/common"
import { AgentsModule } from "@modules/domain/agents"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { BrainFactsModule } from "@modules/domain/brain-facts"
import { KnowledgeGapsModule } from "@modules/domain/knowledge-gaps"
import { InstallationDirectoryService, MODULE_CATALOG, MODULE_CATEGORIES, ModulesModule } from "@modules/domain/modules"
import { ChatRoomDirectoryModule, ChatRoomDirectoryService } from "@modules/domain/chat-room-directory"
import { teamChatEntities } from "@modules/domain/team-chat"
import type { CliAppOptions } from "../cli.options"

/**
 * The setup path the workspace seed applies an agent's setup through (the setup chat, the readiness check and the agent texts), in
 * the setup-only modes: no knowledge lens, no setup turn and no install flow.
 */
export const cliSetupModules = (_options: CliAppOptions): Array<DynamicModule> => [
    AgentsModule.register({
        isGlobal: true,
        setupOnly: true,
        ports: {
            installations: InstallationDirectoryService,
            connections: AgentBindingsService,
            rooms: ChatRoomDirectoryService,
        },
    }),
    ChatRoomDirectoryModule.register({ isGlobal: true, rooms: teamChatEntities[0], seats: teamChatEntities[1] }),
    BrainFactsModule.register({ isGlobal: true }),
    KnowledgeGapsModule.register({ isGlobal: true }),
    ModulesModule.register({
        isGlobal: true,
        categories: MODULE_CATEGORIES,
        catalog: MODULE_CATALOG,
        setupOnly: true,
    }),
]
