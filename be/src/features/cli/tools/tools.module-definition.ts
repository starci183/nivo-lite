import { defineConfigurableModule } from "@starci/nest-kit"
import type { ToolsCliOptions } from "./tools.options"

/** The configurable-module base of the tools module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineConfigurableModule<ToolsCliOptions>()
