import { defineConfigurableModule } from "@starci/nest-kit"
import type { CreditsGraphqlOptions } from "./credits-graphql.options"

/** The configurable-module base of the credits-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<CreditsGraphqlOptions>()
