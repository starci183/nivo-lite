import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { AcceptMetaEventOptions } from "./accept-meta-event.options"

type Host = ConfigurableModuleHost<AcceptMetaEventOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<AcceptMetaEventOptions>().setClassMethodName("register").build()

/** The configurable-module base of the accept-meta-event module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the accept-meta-event module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the accept-meta-event module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
