import { defineConfigurableModule } from "@starci/nest-kit"
import type { DeriveBrainPoliciesOptions } from "./derive-brain-policies.options"

/** The configurable-module base of the derive-brain-policies module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DeriveBrainPoliciesOptions>()
