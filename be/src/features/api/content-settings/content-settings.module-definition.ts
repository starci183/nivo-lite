import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ContentSettingsApiOptions } from "./content-settings.options"

type Host = ConfigurableModuleHost<ContentSettingsApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ContentSettingsApiOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the content-settings module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the content-settings module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the content-settings module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
