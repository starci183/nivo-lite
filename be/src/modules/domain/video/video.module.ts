import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { VideoBrandKitsModule } from "@modules/domain/video-brand-kits"
import { VideoDelegationsModule } from "@modules/domain/video-delegations"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { VideoRenderModule } from "@modules/queues/video-render"
import { VideoMediaService } from "./video-media.service"
import { VideoScriptReadsService } from "./video-script-reads.service"
import { VideoWorkbenchReadsService } from "./video-workbench-reads.service"
import { VideoWorkbenchService } from "./video-workbench.service"
import { VideoProjectEditorService } from "./video-project-editor.service"
import { VideoApprovalService } from "./video-approval.service"
import { VideoApprovalPerformerService } from "./video-approval-performer.service"
import { VideoSharingService } from "./video-sharing.service"
import { VideoScriptingContextService } from "./video-scripting-context.service"
import { VideoScriptingService } from "./video-scripting.service"
import { VideoScriptingCompletionService } from "./video-scripting-completion.service"
import { RendererService } from "./renderer.service"
import { VideoRenderCommandsService } from "./video-render-commands.service"
import { VideoRenderService } from "./video-render.service"
import { VideoService } from "./video.service"
import { EditorDelegationPerformerService } from "./editor-delegation-performer.service"
import { EditorDeliveryService } from "./editor-delivery.service"
import { EditorRoomService } from "./editor-room.service"
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
            imports: [
                ...(base.imports ?? []),
                VideoRenderModule.register({}),
                VideoBrandKitsModule.register({ isGlobal: false }),
                VideoDelegationsModule.register({ isGlobal: false }),
            ],
            providers: [
                ...(base.providers ?? []),
                { provide: VIDEO_ASSETS, useExisting: options.assets },
                { provide: INBOX, useClass: InboxService },
                RendererService,
                VideoService,
                VideoRenderService,
                VideoMediaService,
                VideoWorkbenchService,
                VideoWorkbenchReadsService,
                VideoScriptReadsService,
                VideoProjectEditorService,
                VideoApprovalService,
                VideoApprovalPerformerService,
                VideoSharingService,
                VideoScriptingService,
                VideoScriptingCompletionService,
                VideoScriptingContextService,
                VideoRenderCommandsService,
                EditorRoomService,
                EditorDeliveryService,
                EditorDelegationPerformerService,
            ],
            exports: [
                VIDEO_ASSETS,
                VideoBrandKitsModule,
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
                VideoRenderCommandsService,
            ],
        }
    }
}
