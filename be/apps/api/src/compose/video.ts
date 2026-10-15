import type { ModuleMetadata } from "@nestjs/common"
import { SUPABASE_STORAGE } from "@modules/integrations/supabase"
import { VideoModule } from "@modules/domain/video"
import { VideoProjectVersionsModule } from "@modules/domain/video-project-versions"
import { VideoProjectsModule } from "@modules/domain/video-projects"
import { VideoRendersModule } from "@modules/domain/video-renders"
import { FfmpegModule } from "@modules/integrations/ffmpeg"
import { TtsModule } from "@modules/integrations/tts"
import type { ApiOptions } from "../api.options"
/** The video area of the API, in registration order. */
export const videoModules = (options: ApiOptions): NonNullable<ModuleMetadata["imports"]> => [
    FfmpegModule.register({ isGlobal: true, ...options.ffmpeg }),
    TtsModule.register({ isGlobal: true, ...options.tts }),
    VideoRendersModule.register({ isGlobal: true }),
    VideoProjectsModule.register({ isGlobal: true }),
    VideoProjectVersionsModule.register({ isGlobal: true }),
    VideoModule.register({ isGlobal: true, ...options.video, assets: SUPABASE_STORAGE }),
]
