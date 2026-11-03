import { defineConfigurableModule } from "@starci/nest-kit"
import type { ChatMarkersGraphqlOptions } from "./chatmarkers-graphql.options"

/** The configurable base of the chat markers GraphQL transport. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ChatMarkersGraphqlOptions>()
