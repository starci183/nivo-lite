import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./office-room-directory.module-definition"
import { OfficeRoomDirectoryService } from "./office-room-directory.service"

@Module({
    providers: [OfficeRoomDirectoryService],
    exports: [OfficeRoomDirectoryService],
})
/** The room lookups other capabilities read through: the names of the department rooms and who sits in them. */
export class OfficeRoomDirectoryModule extends ConfigurableModuleClass {}
