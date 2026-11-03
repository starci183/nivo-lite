import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ContentPublishingApiOptions } from "./content-publishing.options"

type Host = ConfigurableModuleHost<ContentPublishingApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ContentPublishingApiOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the content-publishing module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the content-publishing module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the content-publishing module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
