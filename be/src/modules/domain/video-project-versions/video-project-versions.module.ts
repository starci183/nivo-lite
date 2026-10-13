import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./video-project-versions.module-definition"
import { VideoProjectVersionsService } from "./video-project-versions.service"

@Module({})
/** The video-project-versions capability over the primary Supabase PostgreSQL connection: the snapshot of the script and spec a render started from. */
export class VideoProjectVersionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), VideoProjectVersionsService],
            exports: [VideoProjectVersionsService],
        }
    }
}
