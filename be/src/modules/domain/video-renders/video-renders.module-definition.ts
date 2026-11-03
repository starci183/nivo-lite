import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { VideoRendersOptions } from "./video-renders.options"

/** The configurable-module base of the video-renders capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<VideoRendersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    VideoRendersOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: VideoRendersOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
