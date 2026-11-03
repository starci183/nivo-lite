import { defineConfigurableModule } from "@starci/nest-kit"
import type { VideoScriptingMessageOptions } from "./video-scripting-message.options"

/** The configurable-module base of the video-scripting-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<VideoScriptingMessageOptions>()
