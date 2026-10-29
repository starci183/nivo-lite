import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./office-room-directory.module-definition"
import { OfficeRoomDirectoryService } from "./office-room-directory.service"

@Module({})
/** The room lookups other capabilities read through: the names of the department rooms and who sits in them. */
export class OfficeRoomDirectoryModule extends ConfigurableModuleClass {
    /** Registers the directory once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), OfficeRoomDirectoryService],
            exports: [OfficeRoomDirectoryService],
        }
    }
}
