import { Global, Module } from "@nestjs/common"
import { OfficeRoomDirectoryService } from "./office-room-directory.service"

@Global()
@Module({
    providers: [OfficeRoomDirectoryService],
    exports: [OfficeRoomDirectoryService],
})
/** The room lookups other capabilities read through, registrable on its own by an app that composes no Hub rooms. */
export class OfficeRoomDirectoryModule {}
