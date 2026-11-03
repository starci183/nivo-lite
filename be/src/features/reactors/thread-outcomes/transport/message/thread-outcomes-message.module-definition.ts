import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ThreadOutcomesMessageOptions } from "./thread-outcomes-message.options"

type Host = ConfigurableModuleHost<ThreadOutcomesMessageOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ThreadOutcomesMessageOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the thread-outcomes-message module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the thread-outcomes-message module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the thread-outcomes-message module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
