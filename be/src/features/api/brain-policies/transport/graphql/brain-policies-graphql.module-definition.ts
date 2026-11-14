import { defineConfigurableModule } from "@starci/nest-kit"
import type { BrainPoliciesGraphqlOptions } from "./brain-policies-graphql.options"

/** The configurable-module base of the brain-policies-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BrainPoliciesGraphqlOptions>()
