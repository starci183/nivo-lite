import { defineConfigurableModule } from "@starci/nest-kit"
import type { AccountingGraphqlOptions } from "./accounting-graphql.options"

/** The configurable-module base of the accounting-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AccountingGraphqlOptions>()
