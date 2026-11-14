import { defineConfigurableModule } from "@starci/nest-kit"
import type { AgentsCliOptions } from "./agents.options"

/** The configurable-module base of the agents module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AgentsCliOptions>()
