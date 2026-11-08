import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./office-rooms.module-definition"
import { OfficeRoomDirectoryModule } from "./office-room-directory.module"
import { OfficeRoomMembersService } from "./office-room-members.service"
import { OfficeRoomReadsService } from "./office-room-reads.service"
import { OfficeRoomsService } from "./office-rooms.service"

@Module({})
/** The Hub rooms: the department rooms of a workspace, who sits in them, their pins and each person's read marker. */
export class OfficeRoomsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; the directory mode registers only the room directory. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.directoryOnly === true) {
            return {
                ...base,
                imports: [...(base.imports ?? []), OfficeRoomDirectoryModule.register({})],
                exports: [OfficeRoomDirectoryModule],
            }
        }
        return {
            ...base,
            imports: [...(base.imports ?? []), OfficeRoomDirectoryModule.register({})],
            providers: [
                ...(base.providers ?? []),
                OfficeRoomsService,
                OfficeRoomReadsService,
                OfficeRoomMembersService,
            ],
            exports: [OfficeRoomDirectoryModule, OfficeRoomsService],
        }
    }
}
