import { defineCapabilityModule } from "@starci/nest-kit"
import { FFMPEG_OPTIONS } from "./ffmpeg.decorators"
import type { FfmpegOptions } from "./ffmpeg.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<FfmpegOptions>({
    optionsInjectionToken: FFMPEG_OPTIONS,
})
