import { Injectable, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { TEAM_CHAT_TAGS, TeamChatService } from "@modules/domain/team-chat"
import type { TeamChatTags } from "@modules/domain/team-chat"
import { WorkspaceMemberSeatsService, WorkspaceMembersReadService } from "@modules/domain/workspace-members"

/** What a tag handed to the work core, as the proof records it. */
export interface RecordedTag {
    /** The workspace. */
    readonly workspaceId: string
    /** The tag as the chat handed it over. */
    readonly tag: Parameters<TeamChatTags["handOff"]>[1]
}

@Injectable()
/** The work core of a proof: it records every hand-off and allows the agents it was told to allow. */
export class TeamChatTagRecorder implements TeamChatTags {
    /** The hand-offs in the order they came. */
    readonly handed: Array<RecordedTag> = []
    /** The agents the proof lets a person hand work to. */
    allowed: ReadonlyArray<string> = []

    /** Records the hand-off; true for an allowed agent. */
    handOff(workspaceId: string, tag: RecordedTag["tag"]): Promise<boolean> {
        this.handed.push({ workspaceId, tag })
        return Promise.resolve(this.allowed.includes(tag.agentId))
    }
}

@Module({
    providers: [
        TeamChatService,
        WorkspaceMemberSeatsService,
        WorkspaceMembersReadService,
        AgentDirectoryService,
        TeamChatTagRecorder,
        { provide: TEAM_CHAT_TAGS, useExisting: TeamChatTagRecorder },
    ],
    exports: [TeamChatService, TeamChatTagRecorder],
})
/** Runs the team chat over the private PostgreSQL proof database with the capabilities it reads people and agents through. */
export class TeamChatProofModule {
    /** Registers only what the team chat proofs need. */
    static register(): DynamicModule {
        return { module: TeamChatProofModule }
    }
}
