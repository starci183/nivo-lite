import { defineConfigurableModule } from "@starci/nest-kit"
import type { FlowsApiOptions } from "./flows.options"

/** The configurable-module base of the flows module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<FlowsApiOptions>()
