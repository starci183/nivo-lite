import type { DynamicModule } from "@nestjs/common"
import { STORAGE_ASSETS } from "@modules/integrations/object-storage"
import { VIDEO_ERROR_KINDS, VIDEO_MESSAGES, VideoModule } from "@modules/domain/video"
import { VideoProjectVersionsModule } from "@modules/domain/video-project-versions"
import { VideoProjectsModule } from "@modules/domain/video-projects"
import { VIDEO_RENDERS_ERROR_KINDS, VIDEO_RENDERS_MESSAGES, VideoRendersModule } from "@modules/domain/video-renders"
import { FFMPEG_ERROR_KINDS, FFMPEG_MESSAGES, FfmpegModule } from "@modules/integrations/ffmpeg"
import { TTS_ERROR_KINDS, TTS_MESSAGES, TtsModule } from "@modules/integrations/tts"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The video area of the API, in registration order. */
export const videoModules = (options: ApiOptions): Array<DynamicModule> => [
    FfmpegModule.register({ isGlobal: true, ...options.ffmpeg }),
    TtsModule.register({ isGlobal: true, ...options.tts }),
    VideoRendersModule.register({ isGlobal: true }),
    VideoProjectsModule.register({ isGlobal: true }),
    VideoProjectVersionsModule.register({ isGlobal: true }),
    VideoModule.register({ isGlobal: true, ...options.video, assets: STORAGE_ASSETS }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const videoErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    FFMPEG_ERROR_KINDS,
    TTS_ERROR_KINDS,
    VIDEO_ERROR_KINDS,
    VIDEO_RENDERS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const videoMessages: ReadonlyArray<MessageBundle> = [
    FFMPEG_MESSAGES,
    TTS_MESSAGES,
    VIDEO_MESSAGES,
    VIDEO_RENDERS_MESSAGES,
]
