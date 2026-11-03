import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ReplenishStockQueueOptions } from "./replenish-stock-queue.options"

type Host = ConfigurableModuleHost<ReplenishStockQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ReplenishStockQueueOptions>()
    .setClassMethodName("register")
    .build()

/** The configurable-module base of the replenish-stock-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the replenish-stock-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the replenish-stock-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
