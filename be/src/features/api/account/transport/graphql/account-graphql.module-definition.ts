import { defineConfigurableModule } from "@starci/nest-kit"
import type { AccountGraphqlOptions } from "./account-graphql.options"

/** The configurable-module base of the account-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<AccountGraphqlOptions>()
