import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { OfficeCardsService } from "@modules/domain/messages"
import { OfficeRoomMembersService, OfficeRoomReadsService, OfficeRoomsService } from "@modules/domain/office-rooms"
import { StaffService } from "@modules/domain/staff"
import { ACCOUNT_DIRECTORY, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"

@Module({
    providers: [
        OfficeRoomsService,
        OfficeRoomReadsService,
        OfficeRoomMembersService,
        WorkspaceMembersService,
        EventsService,
        StaffService,
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
