import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContentSettingsApiOptions } from "./content-settings.options"

/** The configurable-module base of the content-settings module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ContentSettingsApiOptions>()
