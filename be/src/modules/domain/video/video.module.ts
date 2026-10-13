import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { VideoBrandKitsModule } from "@modules/domain/video-brand-kits"
import { VideoRenderModule } from "@modules/queues/video-render"
import { VideoMediaService } from "./video-media.service"
import { VideoWorkbenchService } from "./video-workbench.service"
import { VideoProjectEditorService } from "./video-project-editor.service"
import { VideoApprovalService } from "./video-approval.service"
import { VideoApprovalPerformerService } from "./video-approval-performer.service"
import { VideoSharingService } from "./video-sharing.service"
import { VideoScriptingContextService } from "./video-scripting-context.service"
import { VideoScriptingService } from "./video-scripting.service"
import { VideoScriptingCompletionService } from "./video-scripting-completion.service"
import { RendererService } from "./renderer.service"
import { VideoRenderService } from "./video-render.service"
import { VideoService } from "./video.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./video.module-definition"

@Module({})
/** The video capability: it queues a render of a project and the render job renders it. Needs the ffmpeg and text-to-speech integrations and the video-renders, video-projects and video-project-versions capabilities registered in the same app. */
export class VideoModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app that renders videos. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), VideoRenderModule, VideoBrandKitsModule.register({ isGlobal: false })],
            providers: [
                ...(base.providers ?? []),
                RendererService,
                VideoService,
                VideoRenderService,
                VideoMediaService,
                VideoWorkbenchService,
                VideoProjectEditorService,
                VideoApprovalService,
                VideoApprovalPerformerService,
                VideoSharingService,
                VideoScriptingService,
                VideoScriptingCompletionService,
                VideoScriptingContextService,
            ],
            exports: [
                ...(base.exports ?? []),
                VideoService,
                VideoRenderService,
                VideoMediaService,
                VideoWorkbenchService,
                VideoProjectEditorService,
                VideoApprovalService,
                VideoApprovalPerformerService,
                VideoSharingService,
                VideoScriptingService,
                VideoScriptingCompletionService,
            ],
        }
    }
}
