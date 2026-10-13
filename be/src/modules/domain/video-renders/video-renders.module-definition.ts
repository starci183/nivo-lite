import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VideoRendersOptions } from "./video-renders.options"

/** The configurable-module base of the video-renders capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<VideoRendersOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
