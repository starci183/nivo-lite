import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./video-brand-kits.module-definition"
import { VideoBrandKitsService } from "./video-brand-kits.service"

@Module({})
/** Workspace video brand kit persistence imported by the video capability. */
export class VideoBrandKitsModule extends ConfigurableModuleClass {
    /** Registers the primary-database kit owner inside the video capability. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), VideoBrandKitsService],
            exports: [VideoBrandKitsService],
        }
    }
}
