import { defineConfigurableModule } from "@starci/nest-kit"
import type { BrainGraphGraphqlOptions } from "./brain-graph-graphql.options"

/** The configurable-module base of the brain-graph-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BrainGraphGraphqlOptions>()
