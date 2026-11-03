import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContractsLinkGraphqlOptions } from "./contracts-link-graphql.options"

/** The configurable-module base of the contracts-link-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContractsLinkGraphqlOptions>()
