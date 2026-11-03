import { defineConfigurableModule } from "@starci/nest-kit"
import type { LeadsGraphqlOptions } from "./leads-graphql.options"

/** The configurable-module base of the leads-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<LeadsGraphqlOptions>()
