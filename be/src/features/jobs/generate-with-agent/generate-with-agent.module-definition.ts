import { defineConfigurableModule } from "@starci/nest-kit"
import type { GenerateWithAgentOptions } from "./generate-with-agent.options"

/** The configurable-module base of the generate-with-agent module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<GenerateWithAgentOptions>()
