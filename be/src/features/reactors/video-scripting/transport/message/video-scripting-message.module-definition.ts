import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { VideoScriptingMessageOptions } from "./video-scripting-message.options"

/** The configurable-module base of the video-scripting-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<VideoScriptingMessageOptions>().setClassMethodName("register").build()
