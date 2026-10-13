import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VideoProjectsOptions } from "./video-projects.options"

/** The configurable-module base of the video-projects capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<VideoProjectsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
