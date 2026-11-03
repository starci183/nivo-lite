import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { VideoProjectsOptions } from "./video-projects.options"

/** The configurable-module base of the video-projects capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<VideoProjectsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    VideoProjectsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: VideoProjectsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
