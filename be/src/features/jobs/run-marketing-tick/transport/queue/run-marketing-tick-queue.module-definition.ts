import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunMarketingTickQueueOptions } from "./run-marketing-tick-queue.options"

type Host = ConfigurableModuleHost<RunMarketingTickQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunMarketingTickQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the run-marketing-tick-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-marketing-tick-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-marketing-tick-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
