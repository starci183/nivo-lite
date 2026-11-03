import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ConnectionCommandsQueueOptions } from "./connection-commands-queue.options"

type Host = ConfigurableModuleHost<ConnectionCommandsQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ConnectionCommandsQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the connection-commands-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the connection-commands-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the connection-commands-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
