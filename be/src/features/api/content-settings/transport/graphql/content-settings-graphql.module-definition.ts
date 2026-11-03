import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ContentSettingsGraphqlOptions } from "./content-settings-graphql.options"

type Host = ConfigurableModuleHost<ContentSettingsGraphqlOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ContentSettingsGraphqlOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the content-settings-graphql module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the content-settings-graphql module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the content-settings-graphql module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
