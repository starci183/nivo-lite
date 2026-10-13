import { ConfigurableModuleBuilder } from "@nestjs/common"
import { FFMPEG_OPTIONS } from "./ffmpeg.decorators"
import type { FfmpegOptions } from "./ffmpeg.options"

/** The configurable-module base of the ffmpeg integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<FfmpegOptions>({
    optionsInjectionToken: FFMPEG_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
