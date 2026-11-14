import { defineConfigurableModule } from "@starci/nest-kit"
import type { ProviderSandboxGraphqlOptions } from "./provider-sandbox-graphql.options"

/** The configurable-module base of the provider-sandbox-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ProviderSandboxGraphqlOptions>()
