import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { VideoMusicOptions } from "./video-music.options"

/** The configurable-module base of the video-music capability. */
const definition = new ConfigurableModuleBuilder<VideoMusicOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    VideoMusicOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: VideoMusicOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
