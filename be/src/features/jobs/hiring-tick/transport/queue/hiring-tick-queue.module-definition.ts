import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { HiringTickQueueOptions } from "./hiring-tick-queue.options"

type Host = ConfigurableModuleHost<HiringTickQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<HiringTickQueueOptions>().setClassMethodName("register").build()

/** The configurable-module base of the hiring-tick-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the hiring-tick-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the hiring-tick-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
