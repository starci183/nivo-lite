import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AdminAccessService } from "./admin-access.service"
import { AdminDirectoryReadsService } from "./admin-directory-reads.service"
import { AdminDirectoryService } from "./admin-directory.service"
import { AdminSupportService } from "./admin-support.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./platform-admin.module-definition"

@Module({})
/** The platform team's console over the primary connection; support actions go through the capabilities that own the data. */
export class PlatformAdminModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app; the capabilities it calls must be registered globally. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                AdminAccessService,
                AdminDirectoryReadsService,
                AdminDirectoryService,
                AdminSupportService,
            ],
            exports: [AdminDirectoryService, AdminSupportService],
        }
    }
}
