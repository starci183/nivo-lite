import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./platform-audit.module-definition"
import { PlatformAuditService } from "./platform-audit.service"

@Module({})
/** The audit trail of the platform team's console over the primary connection. */
export class PlatformAuditModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), PlatformAuditService],
            exports: [PlatformAuditService],
        }
    }
}
