import { defineConfigurableModule } from "@starci/nest-kit"
import type { AdminGraphqlOptions } from "./admin-graphql.options"

/** The configurable-module base of the admin-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AdminGraphqlOptions>()
