import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ContentAiApiOptions } from "./content-ai.options"

type Host = ConfigurableModuleHost<ContentAiApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ContentAiApiOptions>().setClassMethodName("register").build()

/** The configurable-module base of the content-ai module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the content-ai module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the content-ai module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
