import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ChatMarkersApiOptions } from "./chatmarkers.options"

type Host = ConfigurableModuleHost<ChatMarkersApiOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ChatMarkersApiOptions>().setClassMethodName("register").build()

/** The configurable base of the chat markers feature. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable base of the chat markers feature. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable base of the chat markers feature. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
