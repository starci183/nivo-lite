import { defineConfigurableModule } from "@starci/nest-kit"
import type { SepayConnectionGraphqlOptions } from "./sepay-connection-graphql.options"

/** The configurable-module base of the sepay-connection-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<SepayConnectionGraphqlOptions>()
