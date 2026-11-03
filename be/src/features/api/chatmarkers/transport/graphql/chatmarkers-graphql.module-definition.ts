import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ChatMarkersGraphqlOptions } from "./chatmarkers-graphql.options"

type Host = ConfigurableModuleHost<ChatMarkersGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ChatMarkersGraphqlOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable base of the chat markers GraphQL transport. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable base of the chat markers GraphQL transport. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable base of the chat markers GraphQL transport. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
