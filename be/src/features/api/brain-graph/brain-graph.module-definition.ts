import { defineConfigurableModule } from "@starci/nest-kit"
import type { BrainGraphApiOptions } from "./brain-graph.options"

/** The configurable-module base of the brain-graph module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BrainGraphApiOptions>()
