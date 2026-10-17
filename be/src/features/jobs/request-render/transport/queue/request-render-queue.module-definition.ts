import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RequestRenderQueueOptions } from "./request-render-queue.options"

/** The configurable-module base of the request-render-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RequestRenderQueueOptions>().setClassMethodName("register").build()
