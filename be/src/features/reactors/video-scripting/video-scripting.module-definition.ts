import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VideoScriptingOptions } from "./video-scripting.options"

/** The configurable-module base of the video-scripting module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<VideoScriptingOptions>().setClassMethodName("register").build()
