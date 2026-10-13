import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-pillars.module-definition"
import { ContentPillarsService } from "./content-pillars.service"

@Module({})
/** The content-pillars capability over primary PostgreSQL. */
export class ContentPillarsModule extends ConfigurableModuleClass {
    /** Registers the owning service once at the app root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ContentPillarsService],
            exports: [ContentPillarsService],
        }
    }
}
