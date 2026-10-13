import { ConfigurableModuleBuilder } from "@nestjs/common"
import { VIDEO_OPTIONS } from "./video.decorators"
import type { VideoRegistration } from "./video.options"

/** The configurable-module base of the video capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<VideoRegistration>({
    optionsInjectionToken: VIDEO_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
