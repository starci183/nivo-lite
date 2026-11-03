import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ContentPublishingGraphqlOptions } from "./content-publishing-graphql.options"

type Host = ConfigurableModuleHost<ContentPublishingGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ContentPublishingGraphqlOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the content-publishing-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the content-publishing-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the content-publishing-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
