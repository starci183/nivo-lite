import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { VideoRenderOptions } from "./video-render.options"

/** The configurable-module base of the video-render module. */
const definition = new ConfigurableModuleBuilder<VideoRenderOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<VideoRenderOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: VideoRenderOptions = definition.OPTIONS_TYPE
