import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./readiness.module-definition"
import { ReadinessService } from "./readiness.service"

@Module({})
/** Checks the required primary database before this instance receives work. */
export class ReadinessModule extends ConfigurableModuleClass {
    /** Registers the readiness capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ReadinessService], exports: [ReadinessService] }
    }
}
