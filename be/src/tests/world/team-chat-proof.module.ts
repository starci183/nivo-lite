import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { TeamChatService } from "@modules/domain/team-chat"
import { WorkspaceMemberSeatsService, WorkspaceMembersReadService } from "@modules/domain/workspace-members"

@Module({
    providers: [TeamChatService, WorkspaceMemberSeatsService, WorkspaceMembersReadService, AgentDirectoryService],
    exports: [TeamChatService],
})
/** Runs the team chat over the private PostgreSQL proof database with the capabilities it reads people and agents through. */
export class TeamChatProofModule {
    /** Registers only what the team chat proofs need. */
    static register(): DynamicModule {
        return { module: TeamChatProofModule }
    }
}
