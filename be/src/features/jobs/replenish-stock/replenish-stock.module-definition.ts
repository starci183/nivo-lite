import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { ReplenishStockOptions } from "./replenish-stock.options"

type Host = ConfigurableModuleHost<ReplenishStockOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<ReplenishStockOptions>().setClassMethodName("register").build()

/** The configurable-module base of the replenish-stock module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the replenish-stock module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the replenish-stock module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
