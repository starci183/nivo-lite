import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./video-render.module-definition"
import { VideoRenderQueue } from "./video-render.queue"

@Module({ providers: [VideoRenderQueue], exports: [VideoRenderQueue] })
/** The video-render queue: its typed producer, imported by the domain module whose service enqueues. */
export class VideoRenderModule extends ConfigurableModuleClass {}
