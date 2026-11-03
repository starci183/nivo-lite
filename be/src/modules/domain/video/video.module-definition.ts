import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { VIDEO_OPTIONS } from "./video.decorators"
import type { VideoRegistration } from "./video.options"

/** The configurable-module base of the video capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<VideoRegistration>({
    optionsInjectionToken: VIDEO_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    VideoRegistration,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: VideoRegistration &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
