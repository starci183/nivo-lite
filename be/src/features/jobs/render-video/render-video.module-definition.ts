import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RenderVideoOptions } from "./render-video.options"

/** The configurable-module base of the render-video module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RenderVideoOptions>().setClassMethodName("register").build()
