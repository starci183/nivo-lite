import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { VideoScriptingOptions } from "./video-scripting.options"

type Host = ConfigurableModuleHost<VideoScriptingOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<VideoScriptingOptions>().setClassMethodName("register").build()

/** The configurable-module base of the video-scripting module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the video-scripting module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the video-scripting module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
