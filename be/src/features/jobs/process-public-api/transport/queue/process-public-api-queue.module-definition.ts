import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ProcessPublicApiQueueOptions } from "./process-public-api-queue.options"

type Host = ConfigurableModuleHost<ProcessPublicApiQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ProcessPublicApiQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the public API processing queue. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the public API processing queue. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the public API processing queue. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
