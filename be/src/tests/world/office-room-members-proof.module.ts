import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessagesReadService, AgentTestChatsService } from "@modules/domain/agent-messages"
import { AgentDirectoryService } from "@modules/domain/agents"
import { EventsService } from "@modules/domain/events"
import { LeadReadService } from "@modules/domain/leads"
import { MessagesReadService, OfficeCardsService } from "@modules/domain/messages"
import {
    OFFICE_ROOMS_AGENTS,
    OFFICE_ROOMS_LEADS,
    OFFICE_ROOMS_TEST_CHATS,
    OfficeRoomMembersService,
    OfficeRoomReadsService,
    OfficeRoomsService,
} from "@modules/domain/office-rooms"
import { StaffDirectoryService, StaffService } from "@modules/domain/staff"
import {
    ACCOUNT_DIRECTORY,
    WorkspaceMembersReadService,
    WorkspaceMembersService,
} from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"

@Module({
    providers: [
        OfficeRoomsService,
        OfficeRoomReadsService,
        OfficeRoomMembersService,
        WorkspaceMembersService,
        WorkspaceMembersReadService,
        MessagesReadService,
        AgentDirectoryService,
        AgentConversationsReadService,
        AgentMessagesReadService,
        AgentTestChatsService,
        LeadReadService,
        { provide: OFFICE_ROOMS_AGENTS, useExisting: AgentDirectoryService },
        { provide: OFFICE_ROOMS_LEADS, useExisting: LeadReadService },
        { provide: OFFICE_ROOMS_TEST_CHATS, useExisting: AgentTestChatsService },
        EventsService,
        StaffService,
        StaffDirectoryService,
        { provide: ACCOUNT_DIRECTORY, useFactory: () => mock<AccountDirectory>({ accountOf: jest.fn() }) },
        { provide: OfficeCardsService, useFactory: () => mock<OfficeCardsService>({ post: jest.fn() }) },
        { provide: MESSAGE_CATALOG, useFactory: () => mock<MessageCatalog>({ get: jest.fn() }) },
    ],
    exports: [OfficeRoomsService],
})
/** The real room list and workspace admission over PostgreSQL; unused account and write dependencies cannot perform I/O. */
export class OfficeRoomMembersProofModule {
    /** Composes only the reads exercised by the member-preview proofs. */
    static register(): DynamicModule {
        return { module: OfficeRoomMembersProofModule }
    }
}
