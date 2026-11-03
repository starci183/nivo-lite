import { defineConfigurableModule } from "@starci/nest-kit"
import type { OverviewGraphqlOptions } from "./overview-graphql.options"

/** The configurable-module base of the overview-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<OverviewGraphqlOptions>()
