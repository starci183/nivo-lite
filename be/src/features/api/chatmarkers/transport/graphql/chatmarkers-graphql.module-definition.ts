import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ChatMarkersGraphqlOptions } from "./chatmarkers-graphql.options"

/** The configurable base of the chat markers GraphQL transport. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ChatMarkersGraphqlOptions>().setClassMethodName("register").build()
