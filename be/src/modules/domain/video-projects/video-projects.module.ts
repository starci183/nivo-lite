import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./video-projects.module-definition"
import { VideoProjectWorkbenchWriterService } from "./video-project-workbench-writer.service"
import { VideoProjectScriptingService } from "./video-project-scripting.service"
import { VideoProjectsService } from "./video-projects.service"

@Module({})
/** The video-projects capability over the primary PostgreSQL connection: the projects a render is started for and settles. */
export class VideoProjectsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                VideoProjectsService,
                VideoProjectWorkbenchWriterService,
                VideoProjectScriptingService,
            ],
            exports: [VideoProjectsService, VideoProjectWorkbenchWriterService, VideoProjectScriptingService],
        }
    }
}
