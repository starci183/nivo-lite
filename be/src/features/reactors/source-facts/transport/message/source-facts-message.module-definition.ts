import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { SourceFactsMessageOptions } from "./source-facts-message.options"

type Host = ConfigurableModuleHost<SourceFactsMessageOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<SourceFactsMessageOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the source-facts-message module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the source-facts-message module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the source-facts-message module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
