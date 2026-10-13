import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VideoMusicOptions } from "./video-music.options"

/** The configurable-module base of the video-music capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<VideoMusicOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
