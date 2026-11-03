import { defineConfigurableModule } from "@starci/nest-kit"
import type { VideoScriptingOptions } from "./video-scripting.options"

/** The configurable-module base of the video-scripting module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<VideoScriptingOptions>()
