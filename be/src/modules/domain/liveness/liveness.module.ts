import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LivenessService } from "./liveness.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./liveness.module-definition"
import { ReadinessService } from "./readiness.service"

@Module({})
/** Reports process-local liveness and readiness through bounded dependency probes. */
export class LivenessModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), LivenessService, ReadinessService],
            exports: [LivenessService, ReadinessService],
        }
    }
}
