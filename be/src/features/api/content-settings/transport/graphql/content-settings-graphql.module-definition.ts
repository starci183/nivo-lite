import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContentSettingsGraphqlOptions } from "./content-settings-graphql.options"

/** The configurable-module base of the content-settings-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContentSettingsGraphqlOptions>()
