import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { VideoRenderModule } from "@modules/queues/video-render"
import { RendererService } from "./renderer.service"
import { VideoRenderService } from "./video-render.service"
import { VideoService } from "./video.service"
import { VIDEO_ASSETS } from "./video.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./video.module-definition"

@Module({})
/** The video capability: it queues a render of a project and the render job renders it. Needs the ffmpeg and text-to-speech integrations and the video-renders, video-projects and video-project-versions capabilities registered in the same app. */
export class VideoModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app that renders videos; `assets` is the provider token of the file store (a `VideoAssets`) the root binds to the storage integration. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), VideoRenderModule],
            providers: [
                ...(base.providers ?? []),
                { provide: VIDEO_ASSETS, useExisting: options.assets },
                RendererService,
                VideoService,
                VideoRenderService,
            ],
            exports: [VIDEO_ASSETS, VideoService, VideoRenderService],
        }
    }
}
