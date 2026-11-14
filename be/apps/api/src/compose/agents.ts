import { InstallationDirectoryService, MODULES_ERROR_KINDS, MODULES_MESSAGES } from "@modules/domain/modules"
import { AgentKnowledgeLensService } from "@modules/domain/agent-knowledge"
import type { DynamicModule } from "@nestjs/common"
import { AI_USAGE_EVENTS_MESSAGES, UsageGateService } from "@modules/domain/ai-usage-events"
import {
    AGENT_CONNECTIONS_ERROR_KINDS,
    AGENT_CONNECTIONS_MESSAGES,
    AgentBindingsService,
    AgentConnectionsModule,
} from "@modules/domain/agent-connections"
import { AGENT_PROFILE_ERROR_KINDS, AGENT_PROFILE_MESSAGES, AgentProfileModule } from "@modules/domain/agent-profile"
import {
    AGENT_INSTANCES_ERROR_KINDS,
    AGENT_INSTANCES_MESSAGES,
    AgentInstancesModule,
    ConversationOwnersService,
} from "@modules/domain/agent-instances"
import { ToolCallLogModule } from "@modules/domain/tool-call-log"
import { AgentDirectoryService, AgentOwnershipService, AgentsModule } from "@modules/domain/agents"
import {
    AI_GENERATIONS_ERROR_KINDS,
    AI_GENERATIONS_MESSAGES,
    AI_GENERATIONS_POLL_MS,
    AiGenerationsModule,
} from "@modules/domain/ai-generations"
import { WorkItemsActivityService, WorkItemsModule } from "@modules/domain/work-items"
import { ChatRoomDirectoryModule, ChatRoomDirectoryService } from "@modules/domain/chat-room-directory"
import { teamChatEntities } from "@modules/domain/team-chat"
import { AI_TASKS_ERROR_KINDS, AI_TASKS_MESSAGES, AiTasksModule } from "@modules/domain/ai-tasks"
import { REMOTE_FILES_ERROR_KINDS, REMOTE_FILES_MESSAGES, RemoteFilesModule } from "@modules/integrations/remote-files"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/**
 * The stores the old decisions capability re-exported app-wide, registered globally on their own: the members' grants (the workbench door
 * reads a staff member's declared permission there) and the work items (thread approvals write `approve_tool_call` items there).
 */
export const authorityStoreModules = (): Array<DynamicModule> => [
    WorkItemsModule.register({ isGlobal: true }),
]

/** The agents area of the API, in registration order. */
export const agentsModules = (options: ApiOptions): Array<DynamicModule> => [
    RemoteFilesModule.register({ isGlobal: true, ...options.remoteFiles }),
    AiTasksModule.register({
        isGlobal: true,
        ...options.aiTasks,
        recall: AgentKnowledgeLensService,
        meter: UsageGateService,
    }),
    AgentsModule.register({
        isGlobal: true,
        ports: {
            installations: InstallationDirectoryService,
            connections: AgentBindingsService,
            rooms: ChatRoomDirectoryService,
            work: WorkItemsActivityService,
            knowledge: AgentKnowledgeLensService,
            channelOwners: ConversationOwnersService,
        },
    }),
    ChatRoomDirectoryModule.register({ isGlobal: true, rooms: teamChatEntities[0], seats: teamChatEntities[1] }),
    AgentProfileModule.register({ isGlobal: true }),
    AgentConnectionsModule.register({
        isGlobal: true,
        ports: { agents: AgentDirectoryService, managers: AgentOwnershipService },
    }),
    AgentInstancesModule.register({ isGlobal: true }),
    AiGenerationsModule.register({
        isGlobal: true,
        usage: UsageGateService,
        pollMs: AI_GENERATIONS_POLL_MS,
    }),
    ToolCallLogModule.register({ isGlobal: true }),
    ...authorityStoreModules(),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const agentsErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    AGENT_CONNECTIONS_ERROR_KINDS,
    AI_GENERATIONS_ERROR_KINDS,
    REMOTE_FILES_ERROR_KINDS,
    MODULES_ERROR_KINDS,
    AGENT_PROFILE_ERROR_KINDS,
    AGENT_INSTANCES_ERROR_KINDS,
    AI_TASKS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const agentsMessages: ReadonlyArray<MessageBundle> = [
    AGENT_CONNECTIONS_MESSAGES,
    AI_GENERATIONS_MESSAGES,
    AI_USAGE_EVENTS_MESSAGES,
    REMOTE_FILES_MESSAGES,
    MODULES_MESSAGES,
    AGENT_PROFILE_MESSAGES,
    AGENT_INSTANCES_MESSAGES,
    AI_TASKS_MESSAGES,
]
