import { defineConfigurableModule } from "@starci/nest-kit"
import type { BrainPoliciesApiOptions } from "./brain-policies.options"

/** The configurable-module base of the brain-policies module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BrainPoliciesApiOptions>()
