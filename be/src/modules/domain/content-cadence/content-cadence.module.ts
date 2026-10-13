import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-cadence.module-definition"
import { ContentCadenceService } from "./content-cadence.service"

@Module({})
/** The content-cadence capability over primary PostgreSQL. */
export class ContentCadenceModule extends ConfigurableModuleClass {
    /** Registers the owning service once at the app root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ContentCadenceService],
            exports: [ContentCadenceService],
        }
    }
}
