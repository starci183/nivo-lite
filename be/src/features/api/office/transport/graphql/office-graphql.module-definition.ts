import { defineConfigurableModule } from "@starci/nest-kit"
import type { OfficeGraphqlOptions } from "./office-graphql.options"

/** The configurable-module base of the office-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<OfficeGraphqlOptions>()
