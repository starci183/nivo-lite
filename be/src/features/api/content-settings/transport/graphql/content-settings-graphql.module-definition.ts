import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ContentSettingsGraphqlOptions } from "./content-settings-graphql.options"

/** The configurable-module base of the content-settings-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ContentSettingsGraphqlOptions>().setClassMethodName("register").build()
