import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./staff.module-definition"
import { StaffService } from "./staff.service"
import { StaffDirectoryService } from "./staff-directory.service"

@Module({})
/** Registers the staff capability once for the application. */
export class StaffModule extends ConfigurableModuleClass {
    /** Registers the capability and exports its services. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), StaffService, StaffDirectoryService],
            exports: [StaffService, StaffDirectoryService],
        }
    }
}
