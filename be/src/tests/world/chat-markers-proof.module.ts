import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { EventsService } from "@modules/domain/events"
import { TeamChatService } from "@modules/domain/messages"
import { OfficeReadMarkersService } from "@modules/domain/office-rooms"
import { StaffService } from "@modules/domain/staff"
import { ACCOUNT_DIRECTORY, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"

@Module({
    providers: [
        ChatMarkersService,
        AgentMessagesService,
        TeamChatService,
        OfficeReadMarkersService,
        WorkspaceMembersService,
        EventsService,
        StaffService,
        { provide: ACCOUNT_DIRECTORY, useFactory: () => mock<AccountDirectory>({ accountOf: jest.fn() }) },
    ],
    exports: [ChatMarkersService, AgentMessagesService, TeamChatService],
})
/** Runs receipt writes and workspace admission over the private PostgreSQL proof database. */
export class ChatMarkersProofModule {
    /** Registers only the capabilities required by chat marker proofs. */
    static register(): DynamicModule {
        return { module: ChatMarkersProofModule }
    }
}
