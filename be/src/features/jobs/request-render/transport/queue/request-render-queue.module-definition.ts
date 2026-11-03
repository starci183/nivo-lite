import { defineConfigurableModule } from "@starci/nest-kit"
import type { RequestRenderQueueOptions } from "./request-render-queue.options"

/** The configurable-module base of the request-render-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RequestRenderQueueOptions>()
