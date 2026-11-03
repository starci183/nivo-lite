import { defineConfigurableModule } from "@starci/nest-kit"
import type { SeedAgentGraphsOptions } from "./seed-agent-graphs.options"

/** The configurable-module base of the seed-agent-graphs module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SeedAgentGraphsOptions>()
