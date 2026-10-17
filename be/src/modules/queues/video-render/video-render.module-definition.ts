import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VideoRenderOptions } from "./video-render.options"

/** The configurable-module base of the video-render module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<VideoRenderOptions>().setClassMethodName("register").build()
