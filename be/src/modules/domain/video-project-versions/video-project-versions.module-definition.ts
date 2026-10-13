import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VideoProjectVersionsOptions } from "./video-project-versions.options"

/** The configurable-module base of the video-project-versions capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<VideoProjectVersionsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
