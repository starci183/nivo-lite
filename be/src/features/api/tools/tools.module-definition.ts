import { defineConfigurableModule } from "@starci/nest-kit"
import type { ToolsApiOptions } from "./tools.options"

/** The configurable-module base of the tools registry console module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ToolsApiOptions>()
