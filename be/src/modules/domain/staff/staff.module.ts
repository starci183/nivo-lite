import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./staff.module-definition"
import { StaffDirectoryService } from "./staff-directory.service"

@Module({})
/** Registers the staff directory over the globally composed owning capabilities. */
export class StaffDirectoryModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), StaffDirectoryService],
            exports: [StaffDirectoryService],
        }
    }
}
