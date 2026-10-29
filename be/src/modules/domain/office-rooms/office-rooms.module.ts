import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./office-rooms.module-definition"
import { OfficeRoomDirectoryModule } from "./office-room-directory.module"
import { OfficeRoomMembersService } from "./office-room-members.service"
import { OfficeRoomReadsService } from "./office-room-reads.service"
import { OfficeRoomsService } from "./office-rooms.service"
import { OfficeReadMarkersService } from "./office-read-markers.service"

@Module({})
/** The Hub rooms: the department rooms of a workspace, who sits in them, their pins and each person's read marker. */
export class OfficeRoomsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), OfficeRoomDirectoryModule.register({})],
            providers: [
                ...(base.providers ?? []),
                OfficeRoomsService,
                OfficeReadMarkersService,
                OfficeRoomReadsService,
                OfficeRoomMembersService,
            ],
            exports: [OfficeRoomsService, OfficeReadMarkersService, OfficeRoomDirectoryModule],
        }
    }
}
