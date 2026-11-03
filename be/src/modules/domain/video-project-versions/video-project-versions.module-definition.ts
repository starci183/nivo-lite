import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { VideoProjectVersionsOptions } from "./video-project-versions.options"

/** The configurable-module base of the video-project-versions capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<VideoProjectVersionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    VideoProjectVersionsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: VideoProjectVersionsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
