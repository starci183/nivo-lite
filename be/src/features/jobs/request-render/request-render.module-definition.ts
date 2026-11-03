import { defineConfigurableModule } from "@starci/nest-kit"
import type { RequestRenderOptions } from "./request-render.options"

/** The configurable-module base of the request-render module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RequestRenderOptions>()
