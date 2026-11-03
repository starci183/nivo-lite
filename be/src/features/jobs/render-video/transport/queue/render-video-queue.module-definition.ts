import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RenderVideoQueueOptions } from "./render-video-queue.options"

type Host = ConfigurableModuleHost<RenderVideoQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RenderVideoQueueOptions>().setClassMethodName("register").build()

/** The configurable-module base of the render-video-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the render-video-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the render-video-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
