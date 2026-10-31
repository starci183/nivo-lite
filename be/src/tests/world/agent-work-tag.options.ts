import { Injectable, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ChatActivityModule } from "@modules/domain/chat-activity"
import { MessagesModule } from "@modules/domain/messages"
import type { AgentDirectory } from "@modules/domain/messages"
import { OfficeTagService } from "@modules/domain/office-command-candidates"
import { AGENT_WORK_MODULES } from "./agent-work-capabilities.options"

@Injectable()
/** Which agent speaks in the Office, read from the agent directory: a line that names its agent is spoken by it, and no department speaks. */
export class ProofAgentDirectory implements AgentDirectory {
    constructor(private readonly agents: AgentDirectoryService) {}

    agentOfDepartment(): ReturnType<AgentDirectory["agentOfDepartment"]> {
        return Promise.resolve(null)
    }

    async agentById(workspaceId: string, agentId: string): ReturnType<AgentDirectory["agentById"]> {
        const agent = await this.agents.headOf(workspaceId, agentId)
        return agent === null ? null : { id: agent.id, name: agent.name }
    }
}

@Module({})
class AgentTagProofModule {
    /** The Office tag door and what it stands on, bound the way the api composes them. */
    static register(): DynamicModule {
        return {
            module: AgentTagProofModule,
            global: true,
            providers: [ProofAgentDirectory, AgentDirectoryService, OfficeTagService],
            exports: [ProofAgentDirectory, AgentDirectoryService, OfficeTagService],
        }
    }
}

/** The agent work store with the Office on top: lines, activity pushes and the tag door, with the scripted handler and executor. */
export const AGENT_TAG_MODULES = [
    ...AGENT_WORK_MODULES,
    ChatActivityModule.register({ isGlobal: true }),
    AgentTagProofModule.register(),
    MessagesModule.register({ isGlobal: true, agentDirectory: ProofAgentDirectory }),
]
