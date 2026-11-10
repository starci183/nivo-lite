import { defineConfigurableModule } from "@starci/nest-kit"
import type { BrainCriticApiOptions } from "./brain-critic.options"

/** The configurable-module base of the brain-critic module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BrainCriticApiOptions>()
