import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./module-installations.module-definition"
import { InstallationRecordsService } from "./installation-records.service"
import { ModuleInstallationsAdminReadService } from "./module-installations-admin-read.service"

@Module({})
/** The module installations of a workspace, over the primary Supabase PostgreSQL connection. */
export class ModuleInstallationsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ModuleInstallationsAdminReadService, InstallationRecordsService],
            exports: [ModuleInstallationsAdminReadService, InstallationRecordsService],
        }
    }
}
