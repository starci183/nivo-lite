import { defineConfigurableModule } from "@starci/nest-kit"
import type { BrainCriticGraphqlOptions } from "./brain-critic-graphql.options"

/** The configurable-module base of the brain-critic-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BrainCriticGraphqlOptions>()
