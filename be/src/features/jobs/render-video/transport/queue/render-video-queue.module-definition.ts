import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RenderVideoQueueOptions } from "./render-video-queue.options"

/** The configurable-module base of the render-video-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RenderVideoQueueOptions>().setClassMethodName("register").build()
