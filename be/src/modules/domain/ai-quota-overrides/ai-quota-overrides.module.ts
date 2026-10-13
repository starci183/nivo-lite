import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./ai-quota-overrides.module-definition"
import { AiQuotaOverridesService } from "./ai-quota-overrides.service"

@Module({})
/** The per-workspace AI allowances over the primary connection. */
export class AiQuotaOverridesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AiQuotaOverridesService],
            exports: [AiQuotaOverridesService],
        }
    }
}
